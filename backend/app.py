from flask import Flask, request, jsonify
from flask_cors import CORS  # Import CORS
from mason_solver import MasonSolver

app = Flask(__name__)
# Configure CORS to allow requests from your frontend
CORS(app, resources={r"/compute-transfer-function": {"origins": "http://localhost:3000"}})

@app.route('/compute-transfer-function', methods=['POST', 'OPTIONS'])
def compute_tf():
    if request.method == 'OPTIONS':
        # Handle preflight request
        response = jsonify({'status': 'preflight'})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response
    
    data = request.json
    try:
        solver = MasonSolver(
            nodes=data['nodes'],
            edges=data['edges'],
            input_node=data['input_node'],
            output_node=data['output_node']
        )
        result = solver.solve()
        return jsonify({'result': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)