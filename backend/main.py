from fastapi import FastAPI,HTTPException
from fastapi.middleware.cors import CORSMiddleware
from model import TempModel, RainModel, WeatherTypeModel
from pydantic import BaseModel, Field, validator
from utils import logger
from datetime import datetime, timedelta
from collections import Counter
import numpy as np
from typing import List


app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # URL of React application
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the models
temp_model = TempModel()
rain_model = RainModel()
weather_model = WeatherTypeModel()

# Ensure models are trained
temp_model.train()
rain_model.train()
weather_model.train()
weather_model.train_features()

class PredictionInput(BaseModel):
    # Field defines constraints for input validation
    target_date: datetime = Field(..., description="Target date in YYYY-MM-DD format")

    # Validate date input
    # Must be within 1 year before and 3 months after today's date
    @validator("target_date")
    def validate_date(cls, value):
        today = datetime.today().date()
        min = today - timedelta(days=365)
        max = today + timedelta(days=90)
        if ((min > value.date()) or (value.date() > max)):
            raise ValueError("The target date must be within 1 year before and 3 months after today.")
        return value

class MonthlyPredictionInput(BaseModel):
    dates: List[datetime]
    
class DateRangeInput(BaseModel):
    startdate: datetime = Field(..., description="Start date in YYYY-MM-DD format")
    enddate: datetime = Field(..., description="End date in YYYY-MM-DD format")
    
    # Validate date range
    def validate_date(cls, startdate, enddate):
        today = datetime.today().date()
        min = today - timedelta(days=365)
        max = today + timedelta(days=90)
        
        if (startdate.date() >= enddate.date()):
            raise ValueError("The start date must be before the end date.")
        elif ((min >= startdate.date()) & (startdate.date() >= max) &
            (min >= startdate.date()) & (startdate.date() >= max)):
            raise ValueError("The target dates must be within 1 year before and 3 months after today.")
        return startdate, enddate

@app.get("/")
async def root():
    return {"message": "Welcome to the Weather Forecasting API"}


############ Hourly Temperature ############

# Define a GET endpoint for predicting hourly temperature
@app.get("/predict/{target_date}")
async def predict_temp(target_date: datetime):
    try:
        # Predict the temperatures using the model
        mintemp, temp9am, temp3pm, maxtemp = temp_model.predict(target_date)

        # Get the predicted min temperatures of the day before and after
        # to represent 12am values
        daybefore = target_date - timedelta(days=1)
        dayafter = target_date + timedelta(days=1)
        daybeforetemp = temp_model.predict(daybefore) [0]
        dayaftertemp = temp_model.predict(dayafter) [0]

        # Generate hourly temperature data
        hourly_temperatures = temp_model.predict_hourly_temperatures(mintemp, temp9am, temp3pm, maxtemp, daybeforetemp, dayaftertemp)
        
        return {
            "date": target_date,
            "predicted_mintemp": round(mintemp, 1),
            "predicted_maxtemp": round(maxtemp, 1),
            "hourly_temperatures": hourly_temperatures
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

# Define a POST endpoint for predicting hourly temperature
@app.post("/predict")
async def predict_temp(input: PredictionInput):
    try:
        # Validate target_date through PredictionInput for the initial user input
        validated_input = PredictionInput(target_date=input.target_date)
        # Predict the temperatures using the model
        mintemp, temp9am, temp3pm, maxtemp = temp_model.predict(validated_input.target_date)

        # Get the predicted min temperatures of the day before and after
        # to represent 12am values
        daybefore = validated_input.target_date - timedelta(days=1)
        dayafter = validated_input.target_date + timedelta(days=1)
        daybeforetemp = temp_model.predict(daybefore) [0]
        dayaftertemp = temp_model.predict(dayafter) [0]

        # Generate hourly temperature data
        hourly_temperatures = temp_model.predict_hourly_temperatures(mintemp, temp9am, temp3pm, maxtemp, daybeforetemp, dayaftertemp)
        
        logger.info(f"Prediction made: {mintemp} - {maxtemp}°C for {validated_input.target_date}")
        logger.info(f"Prediction for hourly temperature: {hourly_temperatures}")

        # Return the predicted temperatures
        return {
            "date": validated_input.target_date,
            "predicted_mintemp": round(mintemp, 1),
            "predicted_maxtemp": round(maxtemp, 1),
            "hourly_temperatures": hourly_temperatures
        }
    except ValueError as e:
        # Handle error if date input is not valid and raise a 400 Internal Server Error
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Handle any unexpected errors during prediction and raise a 500 Internal Server Error
        logger.error(f"Error during prediction: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


############ Monthly Min and Max Temperature ############


# Define a POST endpoint for predicting monthly min and max temperatures
@app.post("/predict_temp/monthly")
async def predict_temp_monthly(input: MonthlyPredictionInput):
    try:
        temp_data = []
        
        # Generate predictions for each date in the batch/range
        for date in input.dates:
            # Get min/max temps
            prediction = temp_model.predict(date)
            mintemp = prediction[0]
            maxtemp = prediction[3]

            # Append structured data to response list
            temp_data.append({
                "date": date,
                "predicted_mintemp": round(mintemp, 1),
                "predicted_maxtemp": round(maxtemp, 1),
            })

        return {"temp_data": temp_data}
    except Exception as e:
        # Handle any unexpected errors during prediction and raise a 500 Internal Server Error
        logger.error(f"Error during prediction: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")
    

############ Monthly Total Rainfall/Precipitation ############


# Define a POST endpoint for predicting rain
@app.post("/predict_rain")
async def predict_rain(input: MonthlyPredictionInput):
    try:
        # Generate predictions for each month in the batch/range
        rain_data = [
            {
                "date": date,
                "predicted_rain": round(rain_model.predict(date), 1),
                "predicted_totalrain": round(rain_model.total_month(date), 1)
            }
            for date in input.dates
        ]
        return {"rain_data": rain_data}
    except Exception as e:
        # Handle any unexpected errors during prediction and raise a 500 Internal Server Error
        logger.error(f"Error during prediction: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


############ Weather Types ############


# Define a GET endpoint for classifying weather types
@app.get("/predict_weather/{startdate}/{enddate}")
async def predict_weather(startdate: datetime, enddate: datetime):
    try:
        # Predict the weather types for date range using the model
        weather_types = weather_model.predict(startdate, enddate)
        weather_counts = dict(Counter(weather_types))

        # Return the predicted weather types
        return {
            "weather_counts": weather_counts
        }
    except Exception as e:
        # Handle any unexpected errors during prediction and raise a 500 Internal Server Error
        logger.error(f"Error during prediction: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


# Define a POST endpoint for classifying weather types
@app.post("/predict_weather")
async def predict_weather(input: DateRangeInput):
    try:
        # Validate start date and end date for the initial user input
        validated_input = DateRangeInput(startdate=input.startdate, enddate=input.enddate)
        
        # Predict the weather types for date range using the model
        weather_types = weather_model.predict(validated_input.startdate, validated_input.enddate)
        weather_counts = dict(Counter(weather_types))

        logger.info(f"Prediction made: {weather_counts} for {validated_input.startdate} - {validated_input.enddate}")

        # Return the predicted weather types
        return {
            "weather_counts": weather_counts
        }
    except ValueError as e:
        # Handle error if date input is not valid and raise a 400 Internal Server Error
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Handle any unexpected errors during prediction and raise a 500 Internal Server Error
        logger.error(f"Error during prediction: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)