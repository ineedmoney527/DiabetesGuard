# Database Seed Script

This script generates dummy patient users and health data for the application.

## What it does

- Creates 25 dummy patient profiles with realistic names, emails, and demographics
- Generates 3-10 health records per patient with reasonable values
- Assigns risk levels based on glucose and BMI values
- Timestamps records to spread over the last 6 months

## Usage Instructions

1. Install the required dependencies:

   ```
   npm install -g faker uuid
   ```

   or

   ```
   npm install --save-dev faker uuid
   ```

2. Make sure your Firebase service account key (`serviceAccountKey.json`) is in the backend directory

3. Run the seed script:
   ```
   node seed-data.js
   ```

## Customization

You can modify the following constants in the script to adjust the amount of data generated:

- `NUM_PATIENTS`: Number of patient profiles to create (default: 25)
- `MIN_RECORDS`: Minimum number of health records per patient (default: 3)
- `MAX_RECORDS`: Maximum number of health records per patient (default: 10)

You can also adjust the ranges for health metrics in the script to better match your testing needs.

## Data Schema

### User Data

- `name`: Full name
- `email`: Email address
- `gender`: "male" or "female"
- `birthdate`: YYYY-MM-DD format
- `role`: Always "patient"
- `status`: Always "active"
- `createdAt`: Firestore timestamp
- `updatedAt`: Firestore timestamp

### Health Data

- `Pregnancies`: 0-5 (0 for males)
- `Glucose`: 70-200 mg/dL
- `BloodPressure`: 60-140 mmHg
- `Insulin`: 0-200 μU/ml
- `BMI`: 18-40 kg/m²
- `Age`: Calculated from birthdate
- `userId`: Reference to user document
- `timestamp`: Date of record (within last 180 days)
- `prediction`: Contains probability (0.1-0.9) and risk level ("Low/Medium/High Risk")
