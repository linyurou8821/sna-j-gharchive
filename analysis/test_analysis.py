"""Regression checks for the network definitions and published snapshot."""

import csv
import json
import math
import unittest
from collections import Counter, defaultdict
from pathlib import Path

import networkx as nx

from analyze import REPOS, TYPE_LAYER, is_bot
from bridge_analysis import EVENT_LAYERS, connectivity, graph_scores, describe_layer, review_analysis, robustness


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"


class NetworkMathTests(unittest.TestCase):
    def test_two_mode_ranking_excludes_zeroes_and_breaks_ties_by_login(self):
        graph = nx.Graph()
        graph.add_nodes_from(["repo:A", "repo:B", "repo:C"])
        multi = {"z": ["A", "B"], "Z": ["A", "B"], "a": ["A", "B"]}
        graph.add_edges_from((f"actor:{name}", f"repo:{repo}") for name, repos in multi.items() for repo in repos)
        layer = describe_layer(graph, multi, 3, nx.betweenness_centrality(graph))
        self.assertEqual(layer["top"], ["a", "Z", "z"])
        self.assertEqual((layer["eligible"], layer["components"]), (3, 2))
        self.assertEqual(layer["scores"]["a"]["degreeCentrality"], 2 / 3)
        empty = graph.subgraph(["repo:A", "repo:B", "repo:C"])
        self.assertEqual(describe_layer(empty, {}, 3, nx.betweenness_centrality(empty))["top"], [])

    def test_removal_preserves_isolated_repositories_and_uses_remaining_denominator(self):
        graph = nx.Graph()
        graph.add_edges_from([("repo:A", "actor:a"), ("actor:a", "repo:B"),
                              ("repo:B", "actor:b"), ("actor:b", "repo:C")])
        result = robustness(graph, {"b": ["B", "C"], "a": ["A", "B"]})
        row = result["rows"][1]["betweenness"]
        self.assertEqual(row, {"components": 2, "largestRatio": .75, "reachableRatio": .5,
                               "repoReachableRatio": 1 / 3, "edges": 2, "edgesLost": 2})
        self.assertEqual(result["orders"]["betweenness"][0], "a")
        isolate = nx.Graph()
        isolate.add_node("repo:A")
        self.assertIsNone(connectivity(isolate, 0)["reachableRatio"])
        self.assertEqual(graph_scores(isolate, isolate)["repo:A"]["degree"], 0)

    def test_review_binary_undirected_scores_preserve_direction_in_export_only(self):
        review = review_analysis({("a", "b"): 10, ("b", "a"): 3, ("a", "c"): 4})
        self.assertEqual((review["nodes"], review["edges"], len(review["arcs"])), (3, 2, 3))
        self.assertEqual(review["scores"]["a"], {
            "degree": 2, "degreeCentrality": 1, "betweenness": 1, "constraint": .5,
        })
        self.assertEqual(review["scores"]["b"]["constraint"], 1)
        self.assertEqual(review_analysis({})["scores"], {})


class PublishedDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((DOCS / "data.json").read_text(encoding="utf-8"))

    def test_layer_and_review_csv_agree_with_site(self):
        data = self.data
        layers = {layer: data["views"][layer]["bridgeLayer"] for layer in EVENT_LAYERS}
        review = data["reviewNetwork"]["analysis"]
        expected = {k: dict(layer["scores"]) for k, layer in layers.items()}
        expected["review_interaction"] = dict(review["scores"])
        with (DOCS / "repro" / "bridge-scores.csv").open(encoding="utf-8", newline="") as file:
            rows = list(csv.DictReader(file))
        self.assertEqual(len(rows), sum(map(len, expected.values())))
        for row in rows:
            score = expected[row["network"]].pop(row["actor_login"])
            self.assertEqual(int(row["degree"]), score["degree"])
            self.assertEqual(float(row["degree_centrality"]), score["degreeCentrality"])
            self.assertEqual(float(row["betweenness"]), score["betweenness"])
            self.assertEqual(float(row["constraint"]) if row["constraint"] else None, score.get("constraint"))
        self.assertTrue(all(not scores for scores in expected.values()))
        for pair, result in data["bridgeComparison"]["comparisons"].items():
            left, right = (set(layers[key]["top"]) for key in pair.split("-"))
            self.assertEqual(set(result["accounts"]), left & right)
            self.assertEqual(result["jaccard"], len(left & right) / len(left | right) if left | right else None)
        self.assertEqual(sum(count for _, _, count in review["arcs"]), data["reviewNetwork"]["directedEvents"])
        self.assertEqual(len(review["arcs"]), data["reviewNetwork"]["reviewerAuthorPairs"])

    def test_removal_counts_match_the_full_graph_used_in_frontend(self):
        data = self.data["robustness"]
        graph = nx.Graph()
        graph.add_nodes_from(f"repo:{repo}" for repo, _ in REPOS)
        graph.add_edges_from((f"actor:{name}", f"repo:{repo}")
                             for name, repos in data["accountRepos"].items() for repo in repos)
        self.assertEqual((len(graph), graph.number_of_edges()), (data["nodes"], data["edges"]))
        for row in data["rows"]:
            for strategy, names in data["orders"].items():
                subgraph = graph.copy()
                subgraph.remove_nodes_from(f"actor:{name}" for name in names[:row["removed"]])
                self.assertEqual(sum(node.startswith("repo:") for node in subgraph), data["repositories"])
                self.assertEqual(len(subgraph), data["nodes"] - row["removed"])
                self.assertEqual(subgraph.number_of_edges(), row[strategy]["edges"])
                reachable = sum(nx.has_path(subgraph, a, b) for i, a in enumerate(subgraph)
                                for b in list(subgraph)[i + 1:])
                self.assertAlmostEqual(reachable / math.comb(len(subgraph), 2), row[strategy]["reachableRatio"])
            for summary in row["random"].values():
                self.assertLessEqual(summary["min"], summary["mean"])
                self.assertLessEqual(summary["mean"], summary["max"])

    def test_raw_rows_support_layer_edges_and_review_arcs(self):
        path = ROOT / "data" / "raw-events.jsonl"
        if not path.exists():
            self.skipTest("run fetch_events.py first to validate against the source rows")
        rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]
        self.assertEqual(len(rows), self.data["metadata"]["rawRows"])
        accounts = defaultdict(lambda: defaultdict(set))
        arcs = Counter()
        for event in rows:
            actor, author = event["actor_login"], event["creator_user_login"]
            if not actor or is_bot(actor):
                continue
            accounts[TYPE_LAYER[event["event_type"]]][actor].add(event["repo_name"])
            if (event["event_type"] == "PullRequestReviewEvent" and author and
                    actor.casefold() != author.casefold() and not is_bot(author)):
                arcs[actor, author] += 1
        for key in EVENT_LAYERS:
            multi = {actor: repos for actor, repos in accounts[key].items() if len(repos) >= 2}
            layer = self.data["views"][key]["bridgeLayer"]
            self.assertEqual(len(multi), layer["accounts"])
            self.assertEqual(sum(map(len, multi.values())), layer["edges"])
            self.assertEqual(set(multi), set(layer["scores"]))
        self.assertEqual(dict(arcs), {(a, b): n for a, b, n in self.data["reviewNetwork"]["analysis"]["arcs"]})


if __name__ == "__main__":
    unittest.main()
