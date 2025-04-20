FROM python:3.9-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all remaining files (model.pkl, app.py, etc.)
COPY . .

EXPOSE 8080
ENV PORT=8080

CMD ["python", "app.py"]
