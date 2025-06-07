import networkx as nx
from itertools import combinations

class MasonSolver:
    def __init__(self, nodes, edges, input_node, output_node):
        self.G = nx.DiGraph()
        self.G.add_nodes_from(nodes)
        for e in edges:
            gain = e['gain'] if e['gain'] and e['gain'].strip() != '' else '1'
            self.G.add_edge(e['from'], e['to'], gain=gain)
        self.start = input_node
        self.end = output_node
        self.forward_paths = []
        self.loops = []
        self.loop_sets = []  # Store sets for easier comparison

    def find_forward_paths(self):
        try:
            self.forward_paths = list(nx.all_simple_paths(self.G, self.start, self.end))
        except (nx.NodeNotFound, nx.NetworkXNoPath):
            self.forward_paths = []

    def find_loops(self):
        try:
            self.loops = []
            self.loop_sets = []
            for cycle in nx.simple_cycles(self.G):
                if len(cycle) > 1:
                    loop = cycle + [cycle[0]]  # Close the loop
                    self.loops.append(loop)
                    self.loop_sets.append(set(loop))  # Store set for comparison
        except nx.NetworkXNoCycles:
            self.loops = []
            self.loop_sets = []

    def gain(self, path):
        gain_val = "1"
        for i in range(len(path) - 1):
            edge_data = self.G.get_edge_data(path[i], path[i+1])
            if edge_data:
                gain_val += f"*({edge_data['gain']})"
        return gain_val

    def loops_non_touching(self):
        non_touching = []
        # Use stored loop sets for comparison
        for r in range(2, len(self.loop_sets) + 1):
            for combo in combinations(self.loop_sets, r):
                # Check if any loops share common nodes
                all_disjoint = True
                for i in range(len(combo)):
                    for j in range(i+1, len(combo)):
                        if combo[i] & combo[j]:
                            all_disjoint = False
                            break
                    if not all_disjoint:
                        break
                
                if all_disjoint:
                    non_touching.append(combo)
        return non_touching

    def delta(self, exclude_indices=None):
        if exclude_indices is None:
            exclude_indices = []
            
        loop_gains = []
        for i, loop in enumerate(self.loops):
            if i in exclude_indices:
                continue
            loop_gains.append(f"({self.gain(loop)})")
        
        non_touching = self.loops_non_touching()
        gains_by_order = {}
        
        for combo in non_touching:
            order = len(combo)
            product_terms = []
            for loop_set in combo:
                # Find matching loop index using stored loop_sets
                idx = None
                for i, s in enumerate(self.loop_sets):
                    if s == loop_set and i not in exclude_indices:
                        idx = i
                        break
                if idx is not None:
                    product_terms.append(f"({self.gain(self.loops[idx])})")
            
            if product_terms:
                term = "*".join(product_terms)
                if order not in gains_by_order:
                    gains_by_order[order] = []
                gains_by_order[order].append(term)
        
        # Build delta expression
        delta_expr = "1"
        if loop_gains:
            delta_expr += " - (" + " + ".join(loop_gains) + ")"
        
        for order, terms in gains_by_order.items():
            if terms:
                sign = " + " if order % 2 == 0 else " - "
                delta_expr += sign + "(" + " + ".join(terms) + ")"
        
        return delta_expr

    def solve(self):
        self.find_forward_paths()
        if not self.forward_paths:
            return "No path between input and output nodes"
        
        self.find_loops()
        
        numerator_terms = []
        for path in self.forward_paths:
            # Find loops that touch this path
            path_nodes = set(path)
            exclude_indices = []
            for i, loop in enumerate(self.loops):
                if path_nodes & set(loop):
                    exclude_indices.append(i)
            
            delta_k = self.delta(exclude_indices)
            path_gain = self.gain(path)
            numerator_terms.append(f"({path_gain})*({delta_k})")
        
        delta_total = self.delta()
        
        if not numerator_terms:
            return "0"
        
        numerator = " + ".join(numerator_terms)
        transfer_function = f"({numerator}) / ({delta_total})"
        return transfer_function