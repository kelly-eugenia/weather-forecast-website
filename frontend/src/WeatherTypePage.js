import React, { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { Pie } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns'; 
import { format } from 'date-fns';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { 
    Chart as ChartJS, CategoryScale, PointElement, ArcElement, Title, Tooltip, Legend, TimeScale 
} from 'chart.js';
import { 
  Container, Typography, TextField, Button, Paper, Grid, Box, CircularProgress,
} from '@mui/material';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Register necessary Chart.js components and plugins
ChartJS.register(CategoryScale, PointElement, ArcElement, Title, Tooltip, Legend, TimeScale, ChartDataLabels);

// Custom hook to log errors
const useErrorLog = () => {
    return useCallback((error, info) => {
      console.error("Error occurred:", error, info);
    }, []);
};

// Main React component for rendering weather type forecast visualization
function WeatherTypePage() {

    // States for form inputs and chart data
    const [startdate, setStartDate] = useState('');
    const [enddate, setEndDate] = useState('');
    const [chartDataWeather, setChartDataWeather] = useState(null);
    
    // Errors and loading status
    const errorLog = useErrorLog();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Ref to the chart for exporting
    const weatherChartRef = useRef(null);
    // Refs to store initial dates for multiple rendering
    const initialStartDate = useRef('');
    const initialEndDate = useRef('');


    // Function to handle the form submission and fetch weather data
    const handleWeatherType = async (e) => {
        // Reset previous data
        e.preventDefault();
        setError("");
        setChartDataWeather(null);
        setLoading(true); // Show loading indicator

        // Get either the updated or initial date values
        // This is to ensure all date inputs have proper values even if they're not updated
        const finalStartDate = startdate || initialStartDate.current;
        const finalEndDate = enddate || initialEndDate.current;

        // Update initial dates to the new values
        initialStartDate.current = finalStartDate;
        initialEndDate.current = finalEndDate;

        try {
            // Axios call
            // POST and GET requests to retrieve predicted weather data from backend
            await axios.post(`http://localhost:8000/predict_weather`, { startdate, enddate });
            const response = await axios.get(`http://localhost:8000/predict_weather/${startdate}/${enddate}`);
            const weatherCounts = response.data.weather_counts;

            // Call the render function to display pie chart based on the retrieved data
            const newChartDataWeather = renderWeatherPieChart(weatherCounts);
            setChartDataWeather(newChartDataWeather);

        } catch (err) {
            setError("Error fetching weather types data. Make sure your date range is valid.");
            errorLog(err, 'Error fetching weather types data.');
        } finally {
            setLoading(false);  // Stop loading
        }
    };

    // Function to render Pie Chart using Chart.js
    const renderWeatherPieChart = (weatherCounts) => {
        const labels = Object.keys(weatherCounts); // Get weather types from the response
        const data = Object.values(weatherCounts); // Get corresponding counts
        
        return {
            labels: labels,
            datasets: [
                {
                    label: "Number of days",
                    data: data,
                    backgroundColor: [
                        "#54B6D3", 
                        "#FFC261",
                        "#CB4904",
                        "#B3B3B3"
                    ]
                }
            ]
        }
    };

    // Function to export the chart to a PDF file using jsPDF and html2canvas libraries
    const exportToPDF = async () => {
        const pdf = new jsPDF();

        // Capture the current weather chart using the chart reference
        const weatherCanvas = await html2canvas(weatherChartRef.current);
        // Convert to a Data URL in PNG format to add in the PDF
        const weatherImageData = weatherCanvas.toDataURL('image/png');
    
        // Formatting the PDF file
        pdf.text("Weather Type Classification", 10, 10);
        pdf.addImage(weatherImageData, 'PNG', 10, 20, 180, 180);
        
        // Trigger the download of the generated PDF file locally
        pdf.save("weather_forecast.pdf");
    };

    // Render the component
    return (
        <Container maxWidth="md">
            <Box sx={{ my: 4 }}>
                <Typography 
                    variant="h4" 
                    sx={{ 
                        textAlign: 'center', 
                        color: 'primary.main',
                        p: 2
                }}>
                    Weather Type Forecast
                </Typography>

                {/* Date Range Input Form */}

                <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                    <form onSubmit={handleWeatherType}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="overline" gutterBottom>Start date</Typography>
                                <TextField
                                    fullWidth
                                    type="date"
                                    variant="outlined"
                                    value={startdate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Typography variant="overline" gutterBottom>End date</Typography>
                                <TextField
                                    fullWidth
                                    type="date"
                                    variant="outlined"
                                    value={enddate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Button 
                                    type="submit" 
                                    variant="contained" 
                                    color="primary" 
                                    fullWidth
                                    disabled={loading}
                                >
                                    {loading ? <CircularProgress size={24} /> : 'Predict'}
                                </Button>
                            </Grid>
                        </Grid>
                    </form>
                </Paper>
                {error && (
                    <Typography color="error" sx={{ fontSize: 18, mb: 2 }}>
                        {error}
                    </Typography>
                )}
            </Box>

            {/* Display results */}

            {chartDataWeather && startdate && enddate && (
                <>
                <Box sx={{ mt: 3 }} ref={weatherChartRef}>
                    <Box sx={{ mt: 8 }}>
                        <Typography 
                            variant="h6" 
                            gutterBottom
                            textAlign="center"
                            sx={{
                                color: 'primary.main'
                            }}
                            >
                            Weather Types from
                        </Typography>
                        <Typography
                            variant="h4" 
                            gutterBottom
                            textAlign="center"
                            sx={{
                                color: 'secondary.dark',
                                fontWeight: 'bold'
                            }}
                        >
                            <u> {format(new Date(startdate), 'dd MMMM yyyy')} - {format(new Date(enddate), 'dd MMMM yyyy')} </u>
                        </Typography>
                    </Box>

                    {/* Display Pie Chart */}
                    <Paper elevation={3} sx={{ p: 4, mb: 3, mt: 3 }}>
                        <Pie
                            data={chartDataWeather}
                            options={{
                                responsive: true,
                                plugins: {
                                    legend: { 
                                        display: true
                                    },
                                    title: { 
                                        display: true, 
                                        text: 'Weather Types Classification' 
                                    },
                                    datalabels: {
                                        color: '#02154F',
                                        font: {
                                            size: 14,
                                            weight: 'bolder' 
                                        },
                                        formatter: (value) => `${value} days`
                                    }
                                }
                            }}
                            plugins={[ChartDataLabels]}
                        />  
                    </Paper>
                </Box>

                {/* Export Charts to PDF button */}
                <Box sx={{ mt: 3, mb: 10, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button onClick={exportToPDF} variant="contained" color="primary" style={{ margin:24 }}>
                        Export to PDF
                    </Button>
                </Box>
                </>
            )}
        </Container>
    );
}

export default WeatherTypePage;
