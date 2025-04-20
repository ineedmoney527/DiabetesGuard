from flask import Flask, request, jsonify
import pickle
import numpy as np
from flask_cors import CORS
import os
import logging

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load the model
model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model.pkl')
try:
    logger.info(f"Attempting to load model from: {model_path}")
    with open(model_path, 'rb') as f:
        model = pickle.load(f)
    logger.info("Model loaded successfully")
except Exception as e:
    logger.error(f"Error loading model: {e}")
    logger.error(f"Current working directory: {os.getcwd()}")
    logger.error(f"Directory contents: {os.listdir('.')}")
    model = None

@app.route('/predict', methods=['POST'])
def predict():
    try:
        if model is None:
            logger.error("Model is not loaded, cannot make prediction")
            raise Exception("Model is not loaded")
        # Get data from request
        data = request.json
        logger.info(f"Received prediction request: {data}")
        logger.info(f"Request source IP: {request.remote_addr}")
        
        # Extract features in the correct order expected by the model
        logger.info("Extracting features from request data")
        features = [
            float(data.get('Pregnancies', 0)),
            float(data.get('Glucose', 0)),
            float(data.get('BloodPressure', 0)),
            float(data.get('Insulin', 0)),
            float(data.get('BMI', 0)),
            float(data.get('Age', 0))
        ]
        logger.info(f"Extracted features for prediction: {features}")
        
        # Make prediction
        features_array = np.array(features).reshape(1, -1)
        prediction = model.predict(features_array)[0]
        probability = model.predict_proba(features_array)[0][1]  # Probability of class 1
        
        # Determine risk level based on probability
        risk_level = "Low Risk"
        if probability >= 0.7:
            risk_level = "High Risk"
        elif probability >= 0.4:
            risk_level = "Medium Risk"
        
        result = {
            'prediction': int(prediction),
            'probability': float(probability),
            'risk_level': risk_level
        }
        
        logger.info(f"Prediction result: {result}")
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error during prediction: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True) 