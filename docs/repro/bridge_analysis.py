"""Bridge comparisons, review structural holes and account removal."""

import math
import random
from itertools import combinations
from statistics import mean

import networkx as nx


EVENT_LAYERS = ("issues", "pulls", "reviews")
TOP = 10
SEED = 202501
TRIALS = 500


def graph_scores(graph, nodes, between=None):
    if between is None:
        between = nx.betweenness_centrality(graph, normalized=True)
    return {
        node: {"degree": graph.degree(node), "betweenness": round(between[node], 12)}
        for node in sorted(nodes)
    }


def ranking(scores, field, *, ascending=False):
    return sorted(
        (node for node in scores if scores[node][field] is not None),
        key=lambda node: (
            scores[node][field] * (1 if ascending else -1),
            node.casefold(), node,
        ),
    )


def overlap(left, right):
    left, right = set(left), set(right)
    union = left | right
    return {
        "accounts": sorted(left & right, key=lambda node: (node.casefold(), node)),
        "intersection": len(left & right),
        "union": len(union),
        "jaccard": len(left & right) / len(union) if union else None,
    }


def describe_layer(core, multi, repo_count, between):
    aliases = {f"actor:{name}": name for name in multi}
    scores = {
        aliases[node]: {**row, "degreeCentrality": row["degree"] / repo_count}
        for node, row in graph_scores(core, aliases, between).items()
    }
    eligible = [name for name in ranking(scores, "betweenness") if scores[name]["betweenness"] > 0]
    return {
        "nodes": len(core),
        "accounts": len(multi),
        "repositories": repo_count,
        "edges": core.number_of_edges(),
        "components": nx.number_connected_components(core),
        "eligible": len(eligible),
        "top": eligible[:TOP],
        "scores": scores,
    }


def compare_layers(layers):
    tops = {layer: set(layers[layer]["top"]) for layer in EVENT_LAYERS}
    return {
        "limit": TOP,
        "comparisons": {
            f"{a}-{b}": overlap(tops[a], tops[b])
            for a, b in combinations(EVENT_LAYERS, 2)
        },
        "common": sorted(set.intersection(*tops.values()), key=lambda node: (node.casefold(), node)),
        "exclusive": {
            layer: [node for node in layers[layer]["top"]
                    if all(node not in tops[other] for other in EVENT_LAYERS if other != layer)]
            for layer in EVENT_LAYERS
        },
    }


def review_analysis(pairs):
    """Use recorded review ties, then collapse directions for all RQ2 metrics."""
    arcs = sorted(pairs.items())
    graph = nx.Graph()
    graph.add_edges_from((reviewer, author) for (reviewer, author), _ in arcs)
    scores = graph_scores(graph, graph)
    raw_constraint = nx.constraint(graph, weight=None)
    for node, row in scores.items():
        value = raw_constraint[node]
        row["constraint"] = round(value, 12) if math.isfinite(value) else None
        row["degreeCentrality"] = row["degree"] / (len(graph) - 1) if len(graph) > 1 else None
    tops = {
        "degree": ranking(scores, "degree")[:TOP],
        "betweenness": [n for n in ranking(scores, "betweenness") if scores[n]["betweenness"] > 0][:TOP],
        "constraint": ranking(scores, "constraint", ascending=True)[:TOP],
    }
    return {
        "nodes": len(graph),
        "edges": graph.number_of_edges(),
        "components": nx.number_connected_components(graph),
        "scores": scores,
        "top": tops,
        "comparisons": {f"{a}-{b}": overlap(tops[a], tops[b]) for a, b in combinations(tops, 2)},
        "candidates": [n for n in tops["betweenness"] if n in tops["constraint"]],
        "arcs": [[reviewer, author, count] for (reviewer, author), count in arcs],
    }


def connectivity(graph, original_edges):
    components = list(nx.connected_components(graph))
    sizes = [len(component) for component in components]
    repo_sizes = [sum(node.startswith("repo:") for node in component) for component in components]
    all_pairs = math.comb(len(graph), 2)
    repo_pairs = math.comb(sum(repo_sizes), 2)
    edges = graph.number_of_edges()
    return {
        "components": len(sizes),
        "largestRatio": max(sizes, default=0) / len(graph) if len(graph) else None,
        "reachableRatio": sum(math.comb(size, 2) for size in sizes) / all_pairs if all_pairs else None,
        "repoReachableRatio": sum(math.comb(size, 2) for size in repo_sizes) / repo_pairs if repo_pairs else None,
        "edges": edges,
        "edgesLost": original_edges - edges,
    }


def robustness(core, multi, between=None):
    """Static rankings and independent shuffled account orders (nested steps)."""
    aliases = {f"actor:{actor}": actor for actor in multi}
    scores = {aliases[node]: row for node, row in graph_scores(core, aliases, between).items()}
    orders = {field: ranking(scores, field) for field in ("betweenness", "degree")}
    steps = sorted({0, *(min(k, len(scores)) for k in (1, 3, 5, 10))})
    original_edges = core.number_of_edges()

    def measure(names):
        removed = {f"actor:{name}" for name in names}
        return connectivity(core.subgraph(node for node in core if node not in removed), original_edges)

    rng = random.Random(SEED)
    population = sorted(scores)
    random_orders = [rng.sample(population, steps[-1]) for _ in range(TRIALS)]
    rows = []
    for k in steps:
        metrics = [measure(order[:k]) for order in random_orders]
        random_summary = {}
        for field in metrics[0]:
            values = [item[field] for item in metrics if item[field] is not None]
            random_summary[field] = (
                {"mean": mean(values), "min": min(values), "max": max(values)} if values else None
            )
        rows.append({
            "removed": k,
            **{field: measure(order[:k]) for field, order in orders.items()},
            "random": random_summary,
        })
    return {
        "seed": SEED,
        "trials": TRIALS,
        "nodes": len(core),
        "accounts": len(scores),
        "repositories": len(core) - len(scores),
        "edges": original_edges,
        "rows": rows,
        "orders": {field: order[:steps[-1]] for field, order in orders.items()},
        "attackOverlap": overlap(*(order[:steps[-1]] for order in orders.values())),
        "accountRepos": {name: sorted(multi[name]) for name in population},
    }
