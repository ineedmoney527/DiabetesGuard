from flask import Flask, request, jsonify
import pickle
import numpy as np
from flask_cors import CORS
import os
import logging
from google.cloud import logging as cloud_logging
import json

app = Flask(__name__)
CORS(app)

# Configure structured logging with Google Cloud Logging
log_client = None
cloud_logger = None

# Configure basic logging for development/fallback
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Google Cloud Logging for production
try:
    if os.environ.get('ENVIRONMENT') == 'production' and os.environ.get('GOOGLE_CLOUD_PROJECT'):
        # Initialize cloud logging client
        log_client = cloud_logging.Client()
        # Use the shared log name with component label for the ML service
        cloud_logger = log_client.logger('diabetes-guard-logs')
        logger.info("Google Cloud Logging initialized successfully")
    else:
        logger.info("Running in development mode or missing GOOGLE_CLOUD_PROJECT, using local logging")
except Exception as e:
    logger.error(f"Failed to initialize Google Cloud Logging: {e}")

# Helper function for structured logging
def log(level, message, **kwargs):
    # Always include component and service labels
    log_data = {
        "component": "ml-service",
        "service": "diabetes-guard",
        "message": message,
        **kwargs
    }
    
    # Log to cloud logging if available
    if cloud_logger:
        # Map log levels to severity
        severity = "INFO"
        if level == "error":
            severity = "ERROR"
        elif level == "warning":
            severity = "WARNING"
        elif level == "debug":
            severity = "DEBUG"
            
        cloud_logger.log_struct(log_data, severity=severity)
    
    # Fallback to standard logging
    if level == "error":
        logger.error(message, extra={"structured": json.dumps(kwargs)})
    elif level == "warning":
        logger.warning(message, extra={"structured": json.dumps(kwargs)})
    elif level == "debug":
        logger.debug(message, extra={"structured": json.dumps(kwargs)})
    else:
        logger.info(message, extra={"structured": json.dumps(kwargs)})

# Load the model
model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model.pkl')
try:
    log("info", "Attempting to load model", file_path=model_path)
    with open(model_path, 'rb') as f:
        model = pickle.load(f)
    log("info", "Model loaded successfully")
except Exception as e:
    log("error", "Error loading model", error_message=str(e))
    log("error", "Current working directory", directory=os.getcwd())
    log("error", "Directory contents", contents=str(os.listdir('.')))
    model = None

@app.route('/ping', methods=['GET'])
def ping():
    log("info", "Health check received", endpoint="/ping")
    return 'pong', 200


@app.route('/predict', methods=['POST'])
def predict():
    try:
        if model is None:
            log("error", "Model is not loaded, cannot make prediction")
            raise Exception("Model is not loaded")
        # Get data from request
        data = request.json
        log("info", "Received prediction request", request_data=data, source_ip=request.remote_addr)
        
        # Validate and extract features in the correct order expected by the model
        log("info", "Extracting features from request data")
        
        # Ensure all values are valid numbers with default values as fallback
        try:
            pregnancies = float(data.get('Pregnancies', 0)) if data.get('Pregnancies') is not None else 0
            glucose = float(data.get('Glucose', 0)) if data.get('Glucose') is not None else 0
            blood_pressure = float(data.get('BloodPressure', 0)) if data.get('BloodPressure') is not None else 0
            insulin = float(data.get('Insulin', 0)) if data.get('Insulin') is not None else 0
            bmi = float(data.get('BMI', 0)) if data.get('BMI') is not None else 0
            age = float(data.get('Age', 30)) if data.get('Age') is not None else 30  # Default to age 30 if not provided
            
            # Log the parsed values
            log("info", "Parsed feature values", 
                pregnancies=pregnancies,
                glucose=glucose,
                blood_pressure=blood_pressure,
                insulin=insulin,
                bmi=bmi,
                age=age)
            
            # Check for unreasonable values and set defaults if needed
            if age <= 0 or age > 120:
                log("warning", "Age value outside reasonable range", value=age, default=30)
                age = 30
                
            features = [pregnancies, glucose, blood_pressure, insulin, bmi, age]
            
        except (ValueError, TypeError) as e:
            log("error", "Error parsing feature values", error_message=str(e), raw_data=data)
            # Use default values if parsing fails
            features = [0, 0, 0, 0, 0, 30]  # Default values
            
        log("info", "Final features for prediction", features=features)
        
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
        
        log("info", "Prediction computed successfully", result=result)
        return jsonify(result)
    
    except Exception as e:
        log("error", "Error during prediction", error_message=str(e))
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)