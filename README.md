# weather-forecast-website

The Melbourne Weather Forecast Website project is a full-stack web application that combines machine learning models, a FastAPI back-end, and a React-based front-end to provide visual analytics and weather forecasts. The architecture's primary components are specified below:
1. Front-End
React JS is used to design the front end and create dynamic and responsive UI.
Key Components:
App.js: Main App component that allows routing/navigation between the other components/pages
TemperaturePage.js: Component for rendering temperature and precipitation forecast data and visualization
WeatherTypePage.js: Component for rendering weather-type forecast data and visualization
In each main component or page: 
User Input Forms: choose target dates for temperature, precipitation, and weather categorisation predictions 
Data Visualization: present findings as line charts for hourly temperatures, bar charts for monthly trends, and pie charts for weather type classification, Chart.js is used with several plugins for increased usability.
PDF Export: Users can export the displayed chart to a PDF using html2canvas and jsPDF.
2. Back-End
FastAPI is used to create the back-end due to its outstanding performance, ease of creating APIs, and smooth interaction with Python libraries and machine learning models.
Responsibilities:
API Endpoints: Controlled by Axios, the back end makes available API routes that the front end can access through HTTP queries.
Data Processing and Validation: Provide reliable data handling, the tool prepares incoming data for model predictions and verifies user input.
Batch Processing: To reduce server load and response time, batch requests manage date periods for efficiency.
3. AI Model Components
Three machine-learning models addressing various facets of weather forecasting are integrated into the program:
Temperature Prediction Model: To forecast minimum, maximum, and hourly temperatures of a given day
Precipitation Prediction Model: To forecast precipitation of a given day as well as the total monthly amount.
Weather Type Classification Model: To categorize weather types of each day within a given date range.
The models are trained in model.py and loaded as .pkl files in the backend directory.
Overall Flow:
User Interaction: Through the frontend interface, users choose dates and weather analysis settings.
Request Handling: The front end sends an HTTP POST and GET request containing the input data to the FastAPI back-end via Axios.
Model Processing: After processing the input and loading the appropriate machine learning model, the back-end generates and returns predictions.
Response: The front end receives the processed results in JSON format.
Data Visualization: Using Chart.js, the front end shows the prediction results. Users can interact with the charts and export the data if necessary.
