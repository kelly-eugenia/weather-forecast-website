import pandas as pd
import numpy as np
import sklearn
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import PolynomialFeatures
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_squared_error, r2_score, accuracy_score, classification_report, confusion_matrix
from sklearn.preprocessing import PolynomialFeatures
from sklearn.ensemble import RandomForestClassifier
import joblib
from datetime import datetime
from calendar import monthrange
from scipy.interpolate import CubicSpline


### Data Pre-processing for Model Training ###

# Build on the merged dataset from Assignment 2
# Add more features for an improved model more suitable/appropriate for web deployment

data = pd.read_csv('merged_data.csv')

# Extract Day and Month from Date
data['Date'] = pd.to_datetime(data.Date, format='%Y-%m-%d')
data['Day'] = data['Date'].dt.day
data['Month'] = data['Date'].dt.month

# Add more weather-specific rolling or lagged features
# Calculate weekly mean
data['MaxTemp_avg'] = data['MaxTemp'].rolling(7).mean().shift(1)
data['MinTemp_avg'] = data['MinTemp'].rolling(7).mean().shift(1)
data['Wind_avg'] = data['MaxWindSpeed'].rolling(7).mean().shift(1)
data['Cloud_avg'] = (data['9amCloud'] + data['3pmCloud']) / 2
data['Humidity_avg'] = (data['9amHumidity'] + data['3pmHumidity']) / 2

# Calculate previous day's data
data['PrevDayWind'] = data['MaxWindSpeed'].shift(1).fillna(0)
data['PrevDayPrecip'] = data['Precipitation'].shift(1).fillna(0)
data['PrevDayCloud'] = data['Cloud_avg'].shift(1).fillna(0)
data['PrevDaySunshine'] = data['Sunshine'].shift(1).fillna(0)
data['PrevDayHumidity'] = data['Humidity_avg'].shift(1).fillna(0)

# Compare given day's temperature with weekly mean
data['Week_Day_Max'] = data['MaxTemp_avg'] / data['MaxTemp']
data['Week_Day_Min'] = data['MinTemp_avg'] / data['MinTemp']

# Drop NaN values and reset index
data.dropna(inplace=True)
data.reset_index(drop=True, inplace=True)

# Save updated dataset
data.to_csv('new_merged_data.csv')


# Ridge Regression model
# to predict temperature data for the hourly and monthly temperature charts
class TempModel:
    def __init__(self):
        # Initialize the model (Ridge Regression with polynomial features)
        self.model = Ridge()
        self.poly = PolynomialFeatures(degree=2)

    def train(self):
        # Load the dataset
        data = pd.read_csv('new_merged_data.csv')

        # Select features and target
        X = data[['Day', 'Month', 'MaxTemp_avg', 'MinTemp_avg',  'Wind_avg', 'Week_Day_Max', 'Week_Day_Min']]  # Input data
        y = data[['MinTemp', '9amTemp', '3pmTemp', 'MaxTemp']]  # Target variable

        # Split the data into training and testing sets
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        # Transform the features into polynomial features
        X_train_poly = self.poly.fit_transform(X_train)
        X_test_poly = self.poly.transform(X_test)

        # Train the polynomial regression model
        self.model.fit(X_train_poly, y_train)

        # Save the model and the polynomial transformer
        joblib.dump(self.model, 'temp_model.pkl')
        joblib.dump(self.poly, 'polytemp_transformer.pkl')

        # Evaluation
        y_pred = self.model.predict(X_test_poly)
        print("\nTemperature Polynomial Regression")
        print("-------------------------")
        print("Mean Squared Error: %.2f" % mean_squared_error(y_test, y_pred))
        print("R^2 Score: %.2f" % r2_score(y_test, y_pred))
    
    def predict(self, target_date):
        # Prepare the dataset and load the model
        data = pd.read_csv("new_merged_data.csv")
        self.model = joblib.load('temp_model.pkl')
        self.poly = joblib.load('polytemp_transformer.pkl')
        
        # Extract day and month from date
        day = target_date.day
        month = target_date.month

        # Ensure 'Date' column is in datetime format
        data['Date'] = pd.to_datetime(data['Date'], format='%Y-%m-%d')

        # Filter data up to the target_date
        filtered_data = data[data['Date'] < target_date]

        # Extract only the latest values from the filtered data
        maxtemp_avg = filtered_data['MaxTemp_avg'].iloc[-1]
        mintemp_avg = filtered_data['MinTemp_avg'].iloc[-1]
        wind_avg = filtered_data['Wind_avg'].iloc[-1]
        week_day_max = filtered_data['Week_Day_Max'].iloc[-1]
        week_day_min = filtered_data['Week_Day_Min'].iloc[-1]

        # Transform the input features into polynomial features
        X_input_poly = self.poly.transform([[day, month, maxtemp_avg, mintemp_avg, wind_avg, week_day_max, week_day_min]])

        # Model prediction
        prediction = self.model.predict(X_input_poly)

        return prediction[0]

    def predict_hourly_temperatures(self, min_temp, temp_9am, temp_3pm, max_temp, daybefore, dayafter):
        # Define the hours and corresponding temperatures
        hours = [0, 6, 9, 15, 18, 25]  # Approximate times for min, 9am, 3pm, max temps
        temperatures = [daybefore, min_temp, temp_9am, temp_3pm, max_temp, dayafter]

        # Perform cubic spline interpolation
        cs = CubicSpline(hours, temperatures)

        # Predict hourly temperatures
        hourly_hours = np.arange(0, 25)
        hourly_temperatures = cs(hourly_hours)

        # Return hourly predictions in a dictionary for easy JSON serialization
        hourly_data = [{"hour": int(hour), "temperature": float(round(temp, 1))} for hour, temp in zip(hourly_hours, hourly_temperatures)]
        return hourly_data
    

# Ridge Regression model
# to predict precipitation data for the monthly total precipitation bar chart    
class RainModel:
    def __init__(self):
        # Initialize the model (Ridge Regression with polynomial features)
        self.model = Ridge()
        self.poly = PolynomialFeatures(degree=2)
    
    def train(self):
        # Load the dataset
        data = pd.read_csv('new_merged_data.csv')

        # Select features and target
        X = data[['Day', 'Month', 'MinTemp', 'MaxTemp', 'Humidity_avg', 'Cloud_avg',
                  'PrevDayPrecip', 'PrevDayHumidity']]  # Input data
        y = data['Precipitation']  # Target variable

        # Split the data into training and testing sets
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

        # Transform the features into polynomial features
        X_train_poly = self.poly.fit_transform(X_train)
        X_test_poly = self.poly.transform(X_test)

        # Train the polynomial regression model
        self.model.fit(X_train_poly, y_train)

        # Save the model and the polynomial transformer
        joblib.dump(self.model, 'rain_model.pkl')
        joblib.dump(self.poly, 'polyrain_transformer.pkl')

        # Evaluation
        y_pred = self.model.predict(X_test_poly)
        print("\nRain Polynomial Regression")
        print("-------------------------")
        print("Mean Squared Error: %.2f" % mean_squared_error(y_test, y_pred))
        print("R^2 Score: %.2f" % r2_score(y_test, y_pred))
    
    def predict(self, target_date):
        # Prepare the dataset and load the model
        data = pd.read_csv("new_merged_data.csv")
        self.model = joblib.load('rain_model.pkl')
        self.poly = joblib.load('polyrain_transformer.pkl')
        
        # Extract day, month, and year from date
        day = target_date.day
        month = target_date.month

        # Ensure 'Date' column is in datetime format
        data['Date'] = pd.to_datetime(data['Date'], format='%Y-%m-%d')

        # Filter data up to the target_date
        filtered_data = data[data['Date'] < target_date]

        # Extract only the latest values from the filtered data
        maxtemp = filtered_data['MaxTemp'].iloc[-1]
        mintemp = filtered_data['MinTemp'].iloc[-1]
        humidity = filtered_data['Humidity_avg'].iloc[-1]
        cloud = filtered_data['Cloud_avg'].iloc[-1]
        prevprecip = filtered_data['PrevDayPrecip'].iloc[-1]
        prevhumid = filtered_data['PrevDayHumidity'].iloc[-1]

        # Transform the input features into polynomial features
        X_input_poly = self.poly.transform([[day, month, mintemp, maxtemp, humidity, cloud, prevprecip, prevhumid]])

        # Model prediction
        prediction = self.model.predict(X_input_poly)

        if (prediction[0] < 0):
            prediction[0] = 0

        return prediction[0]
    

    # Calculate total precipitation amount for the whole month
    def total_month(self, target_date):
        month = target_date.month
        year = target_date.year

        # Get the first day of the month
        startdate = datetime(year, month, 1)
        # Get the last day of the month
        lastday = monthrange(year, month)[1]
        enddate = datetime(year, month, lastday) 

        # Generate date range
        daterange = pd.date_range(start=startdate, end=enddate)
        
        # Calculate total precipitation amount for the whole month
        total = 0
        for date in daterange:
            r_pred = self.predict(date) # Predict the precipitation value for each day
            total += r_pred

        return total


# Random Forest Classifier model
# to predict weather data and classify them into weather types within a date range 
# for the weather type pie chart
class WeatherTypeModel:
   def __init__(self):
      # Initialize the model (Random Forest Classifier)
      self.model = RandomForestClassifier(n_estimators=100, random_state=42)

      # Initialize model to get forecasted features (Ridge)
      self.features = Ridge()

   # To train random forest classfier model for classifying weather types
   def train(self):
      # Load the dataset
      data = pd.read_csv('new_merged_data.csv')

      X = data[['MaxTemp', 'MinTemp', 'Precipitation', 'MaxWindSpeed', '9amCloud', '3pmHumidity', 'Sunshine']] # Input data
      y = data['WeatherType'] # Target

      # Split the data into training and testing sets
      X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

      # Train the model
      self.model.fit(X_train, y_train)

      # Save the model
      joblib.dump(self.model, 'randomforest_model.pkl')

      # Model evaluation
      y_pred = self.model.predict(X_test)
      print("\nWeather Types Classification")
      print("-------------------------------")
      accuracy = accuracy_score(y_test, y_pred)
      print(f'Accuracy: {accuracy}')
      print('Classification Report:')
      print(classification_report(y_test, y_pred))

      # Confusion Matrix
      conf_matrix = confusion_matrix(y_test, y_pred)
      print('Confusion Matrix:')
      print(conf_matrix)

   # To train regression model for predicting features data
   def train_features(self):
      data = pd.read_csv("new_merged_data.csv")

      # Select features and target
      X = data[['Day', 'Month', 'MaxTemp_avg', 'MinTemp_avg', 'Wind_avg', 'Cloud_avg', 'Humidity_avg', 
                'PrevDayWind', 'PrevDayPrecip', 'PrevDayHumidity', 'PrevDayCloud', 'PrevDaySunshine']]  # Input data
      y = data[['MaxTemp', 'MinTemp', 'Precipitation', 'MaxWindSpeed', '9amCloud', '3pmHumidity', 'Sunshine']]  # Target variable (Features of the RF model)

      # Split the data into training and testing sets
      X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

      # Train the model
      self.features.fit(X_train, y_train)

      # Save the model
      joblib.dump(self.features, 'rf_features_model.pkl')

      # Model Evaluation
      y_pred = self.features.predict(X_test)
      print("\nFeatures Ridge Regression")
      print("-------------------------")
      print("Mean Squared Error: %.3f" % mean_squared_error(y_test, y_pred))
      print("R^2 Score: %.3f" % r2_score(y_test, y_pred))

   # To predict features
   def predict_features(self, target_date):
      # Prepare the dataset and load the model
      data = pd.read_csv("new_merged_data.csv")
      self.features = joblib.load('rf_features_model.pkl')
      
      # Extract day, month, and year from date
      day = target_date.day
      month = target_date.month

      # Ensure 'Date' column is in datetime format
      data['Date'] = pd.to_datetime(data['Date'], format='%Y-%m-%d')

      # Filter data up to the target_date
      filtered_data = data[data['Date'] < target_date]

      # Extract only the latest values from the filtered data
      maxtemp_avg = filtered_data['MaxTemp_avg'].iloc[-1]
      mintemp_avg = filtered_data['MinTemp_avg'].iloc[-1]
      wind_avg = filtered_data['Wind_avg'].iloc[-1]
      cloud_avg = filtered_data['Cloud_avg'].iloc[-1]
      humidity_avg = filtered_data['Humidity_avg'].iloc[-1]
      prevwind = filtered_data['MaxWindSpeed'].iloc[-1]
      prevcloud = filtered_data['Cloud_avg'].iloc[-1]
      prevhumidity = filtered_data['Humidity_avg'].iloc[-1]
      prevprecip = filtered_data['Sunshine'].iloc[-1]
      prevsunshine = filtered_data['Precipitation'].iloc[-1]

      # Model prediction
      prediction = self.features.predict([[day, month, maxtemp_avg, mintemp_avg, wind_avg, cloud_avg, humidity_avg, prevwind, prevcloud, prevhumidity, prevprecip, prevsunshine]])
      
      return prediction[0]
   
   # To predict weather types classification of a given date range
   def predict(self, startdate, enddate):
      # Prepare the dataset and load the model
      data = pd.read_csv("new_merged_data.csv")
      self.model = joblib.load('randomforest_model.pkl')
      self.features = joblib.load('rf_features_model.pkl')

      # Ensure 'Date' column is in datetime format
      data['Date'] = pd.to_datetime(data['Date'], format='%Y-%m-%d')

      # Generate date range
      daterange = pd.date_range(start=startdate, end=enddate)

      # Predict the features' values for each date
      features_predictions = []
      for date in daterange:
         f_pred = self.predict_features(date)
         features_predictions.append(f_pred)

      # Model prediction
      prediction = self.model.predict(features_predictions)

      return prediction

# For initial training
if __name__ == "__main__":
    model = TempModel()
    model.train()