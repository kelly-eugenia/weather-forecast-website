import React, { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns'; // Import the date adapter
import { format, subMonths, addMonths, getDate, getMonth, getYear, getDaysInMonth } from 'date-fns';
import zoomPlugin from 'chartjs-plugin-zoom'; // Import the zoom plugin
import { 
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, TimeScale 
} from 'chart.js';
import { 
    Container, Typography, TextField, Button, ButtonGroup, Paper, Grid, Box, CircularProgress,
} from '@mui/material';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';


// Register necessary Chart.js components and plugins
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, TimeScale, zoomPlugin);

// Custom hook to log errors
const useErrorLog = () => {
    return useCallback((error, info) => {
      console.error("Error occurred:", error, info);
    }, []);
};

// Main React component for rendering temperature and precipitation forecast visualization
function TemperaturePage() {
    
    // States for form inputs and target dates
    const [target_date, setTarget] = useState(new Date());
    const [date, setDate] = useState(new Date());
    const [currentMonth, setCurrentMonth] = useState(new Date());
    
    // States for predicted values and chart data
    const [predictedMinTemp, setPredictedMinTemp] = useState(null);
    const [predictedMaxTemp, setPredictedMaxTemp] = useState(null);
    const [chartDataHourly, setChartDataHourly] = useState(null);
    const [chartDataTempMonthly, setChartDataTempMonthly] = useState(null);
    const [chartDataPrecipitation, setChartDataPrecipitation] = useState(null);
    const [selectedChartType, setSelectedChartType] = useState('temperature'); // 'temperature' or 'precipitation'
  
    // Errors and loading status
    const errorLog = useErrorLog();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
  
    // Ref to the charts for exporting
    const tempMinMaxRef = useRef(null);
    const hourlyChartRef = useRef(null);
    const monthlyChartRef = useRef(null);
    const chartRef = useRef(null);
  
    // Function to parse a date string into a Date object in 'YYYY-MM-DD' format
    function parseDate(target_date) {
      // Split date string by "-" and construct a new Date object
      const [year, month, day] = target_date.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
  
    // Generate a date range based on target date for monthly charts data retrieval
    const createDateRange = (targetDate) => {
        const dates = [];
        let startDate = subMonths(new Date(targetDate), 3); // Start 3 months before the target date
        const endDate = addMonths(new Date(targetDate), 3); // End 3 months after the target date
        
        const targetDay = getDate(new Date(targetDate)); // Get the day (dd)

        while (startDate <= endDate) {
          // Get the month and year of the current date
          const targetMonth = getMonth(new Date(startDate));
          const targetYear = getYear(new Date(startDate));

          // Determine the number of days in the current month
          const daysInMonth = getDaysInMonth(startDate);
      
          // If target day exceeds days in month, use the last day of the month
          if (targetDay > daysInMonth) {
            let date = new Date(targetYear, targetMonth, daysInMonth);
            dates.push(format(date, 'yyyy-MM-dd'));
          }
          else {
            let date = new Date(targetYear, targetMonth, targetDay);
            dates.push(format(date, 'yyyy-MM-dd'));
          }

          // Move to the next month
          startDate = addMonths(startDate, 1);
        }
      
        return dates;
    };
  

    // Function to handle the form submission and fetch weather data
    const handleSubmit = async (e) => {
      // Reset previous data
      e.preventDefault();
      setError('');
      setPredictedMinTemp(null);
      setPredictedMaxTemp(null);
      setChartDataTempMonthly(null); 
      setChartDataHourly(null);
      setLoading(true); // Show loading indicator
  
      try {
        // Axios call
        // POST and GET requests to retrieve predicted weather data from backend
        // Validate the target date by sending a POST request
        await axios.post(`http://localhost:8000/predict`, { target_date });

        const response = await axios.get(`http://localhost:8000/predict/${target_date}`);
        setPredictedMinTemp(response.data.predicted_mintemp);
        setPredictedMaxTemp(response.data.predicted_maxtemp);
        setDate(target_date);
        setCurrentMonth(target_date)
        
        // Prepare hourly temperature data for Chart.js
        const hourlyLabels = response.data.hourly_temperatures.map((item) => `${item.hour}:00`);
        const hourlyData = response.data.hourly_temperatures.map((item) => item.temperature);
        
        // Call the render function to display line chart based on the retrieved data
        const newChartDataHourly = renderHourlyLineChart(hourlyLabels, hourlyData);
        setChartDataHourly(newChartDataHourly);

        // Call the render function to fetch and display monthly bar chart based on the selected tab
        renderMonthly(target_date);

      } catch (err) {
        setError('Error predicting temperature. The target date must be within 1 year before and 3 months after today.');
        errorLog(err, 'Error predicting temperature');
      } finally {
        setLoading(false); // Stop loading
      }
    };

    // Function to render Hourly Temperature Line Chart using Chart.js
    const renderHourlyLineChart  = (hourlyLabels, hourlyData) => {
        return {
            labels: hourlyLabels, // Hourly labels for the line chart
            datasets: [
            {
                label: 'Hourly Temperature',
                data: hourlyData,
                borderColor: 'rgb(84, 182, 211)',
                backgroundColor: 'rgba(84, 182, 211, 0.2)',
                fill: true,
                tension: 0.1
            }
            ]
        }
    };

    // Handle month increment/decrement for monthly chart navigation
    const handleMonthChange = (increment) => {
      const newDate = format(addMonths(new Date(date), increment), 'yyyy-MM-dd'); // Increment or decrement month
      setDate(newDate);

      //console.log("Date: ", newDate)
      setCurrentMonth(newDate);

      // Display updated bar chart with the new date values
      renderMonthly(newDate);
    };

    // Function to fetch predicted data and 
    // render Monthly Temperature and Precipitation Bar Charts using Chart.js
    const renderMonthly = async (targetDate) => {
      setError('');
      setLoading(true);      
  
      // Get monthly range from the target date
      // 3 months before and after the target month
      const dateRange = createDateRange(targetDate);
  
      try {
        // console.log(dateRange)

        /////////////////////////////////////
        // Monthly Min and Max Temperature //
        /////////////////////////////////////

        // Axios call
        // Make a single batch POST request to the backend with all dates in dateRange
        // Fetch the predicted temperature values for each date
        const temp_response = await axios.post(`http://localhost:8000/predict_temp/monthly`, { dates: dateRange });
        const temp_data = temp_response.data.temp_data;
        
        // Monthly Temperature chart data
        const newChartDataTempMonthly = {
          labels: dateRange,
          datasets: [
            {
              label: 'Min Temp',
              data: temp_data.map((d) => d.predicted_mintemp),
              backgroundColor: 'rgb(84, 182, 211)',
              stack: 'combined', // Stacked bar chart
              type: 'bar',
              order: 1,
              tension: 0.1
            },
            {
              label: 'Max Temp',
              data: temp_data.map((d) => d.predicted_maxtemp),
              backgroundColor: 'rgb(255, 194, 97)',
              stack: 'combined', // Stacked bar chart
              type: 'bar',
              order: 1,
              tension: 0.1
            },
            {
              label: "Target Date's Min Temp",
              data: [{ 
                x: parseDate(targetDate), 
                y: temp_data.find(d => format(new Date(d.date), 'yyyy-MM-dd') === targetDate).predicted_mintemp 
              }],
              borderColor: 'rgb(64, 134, 155)',
              backgroundColor: 'rgba(64, 134, 155, 0.4)',
              pointRadius: 8,
              pointHoverRadius: 12,
              order: 0,
              showLine: false // Show only the point for the user's prediction
            },
            {
              label: "Target Date's Max Temp",
              data: [{ 
                x: parseDate(targetDate), 
                y: temp_data.find(d => format(new Date(d.date), 'yyyy-MM-dd') === targetDate).predicted_maxtemp 
              }],
              borderColor: 'rgb(242, 150, 59)',
              backgroundColor: 'rgba(242, 150, 59, 0.4)',
              pointRadius: 8,
              pointHoverRadius: 12,
              order: 0,
              showLine: false // Show only the point for the user's prediction
            }
          ]
        };
        setChartDataTempMonthly(newChartDataTempMonthly);
  

        ///////////////////////////////////
        //  Monthly Total Precipitation  //
        ///////////////////////////////////

        
        // Axios call
        // Make a single batch POST request to the backend with all dates in dateRange
        // Fetch the predicted precipitation values for each date
        const rain_response = await axios.post(`http://localhost:8000/predict_rain`, { dates: dateRange });
        const rain_data = rain_response.data.rain_data;
  
        // Total monthly precipitation chart data
        const newChartDataPrecipitation = {
          labels: dateRange,
          datasets: [
            {
              label: 'Total Monthly Precipitation',
              data: rain_data.map((d) => d.predicted_totalrain),
              backgroundColor: 'rgb(89, 160, 181)',
              stack: 'combined',
              type: 'bar',
              order: 1,
              tension: 0.1
            },
            {
              label: "Target Date's Precipitation", 
              data: [{ 
                x: parseDate(targetDate), 
                y: rain_data.find(d => format(new Date(d.date), 'yyyy-MM-dd') === targetDate).predicted_rain 
            }],
              borderColor: 'rgb(57, 72, 115)',
              backgroundColor: 'rgba(57, 72, 115, 0.4)',
              pointRadius: 8,
              pointHoverRadius: 12,
              order: 0,
              showLine: false // Show only the point for the user's prediction
            }
          ]
        };
        setChartDataPrecipitation(newChartDataPrecipitation);
  
      } catch (err) {
        setError('Error fetching data for the month.');
        console.error(err);
      } finally {
        setLoading(false);  // Stop loading
      }
    };
    
    // Function to export charts to a PDF file using jsPDF and html2canvas libraries
    const exportToPDF = async () => {
      const pdf = new jsPDF();

      // Capture the current line and bar charts using the charts reference
      const hourlyCanvas = await html2canvas(hourlyChartRef.current);
      const monthlyCanvas = await html2canvas(monthlyChartRef.current);
      // Convert to a Data URL in PNG format to add in the PDF
      const hourlyImageData = hourlyCanvas.toDataURL('image/png');
      const monthlyImageData = monthlyCanvas.toDataURL('image/png');
      
      // Formatting the PDF file
      pdf.text("Weather Forecast", 10, 10);
      pdf.addImage(hourlyImageData, 'PNG', 10, 20, 180, 100);
      pdf.addPage();
      pdf.addImage(monthlyImageData, 'PNG', 10, 20, 180, 130);

      // Trigger the download of the generated PDF file locally
      pdf.save("weather_forecast.pdf");
    };
    
    // Function to reset zoom
    const handleResetZoom = () => {
      if (chartRef.current) {
        chartRef.current.resetZoom(); // Reset zoom level to initial state
      }
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
            Daily Temperature Forecast
          </Typography>

          {/* Target Date Input Form */}

          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <form onSubmit={handleSubmit}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="overline" gutterBottom>Target date</Typography> 
                  <TextField
                    fullWidth
                    type="date"
                    variant="outlined"
                    value={target_date}
                    onChange={(e) => setTarget(e.target.value)}
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
                    sx= {{ mb: 1 }}
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
  
        <Box sx={{ mt: 3 }}>
          {target_date && chartDataHourly && chartDataTempMonthly && (
            <>
            <Box sx={{ mt: 8 }}>
              <Typography 
                variant="h4" 
                gutterBottom
                textAlign="center"
                sx={{
                    color: 'primary.main',
                    fontWeight: 'bold'
                }}
                >
                Weather on 
                <span style={{ color: '#54B6D3'}}> <u>
                    {format(new Date(target_date), 'EE, dd MMMM yyyy')} </u>
                </span> 
              </Typography>
            </Box>
          
            {/* Min and Max Temperature */}

            {predictedMinTemp && predictedMaxTemp && (
                <Box sx={{ mt: 3 }} ref={tempMinMaxRef}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                                <Typography variant="h6" gutterBottom sx={{textAlign:'center', color:'primary.light', fontWeight:400}}>
                                    Min Temperature
                                </Typography>
                                <Typography variant="h3" gutterBottom sx={{textAlign:'center', color:'secondary.dark', fontWeight:800}}>
                                    {predictedMinTemp.toLocaleString()}°C
                                </Typography>
                            </Paper>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                                <Typography variant="h6" gutterBottom sx={{textAlign:'center', color:'primary.light', fontWeight:400}}>
                                    Max Temperature
                                </Typography>
                                <Typography variant="h3" gutterBottom sx={{textAlign:'center', color:'primary.main', fontWeight:800}}>
                                    {predictedMaxTemp.toLocaleString()}°C
                                </Typography>
                            </Paper>
                        </Grid>
                    </Grid>
                </Box>
            )}
  
            {/* Hourly Temperature Chart */}

            <Box sx={{ mt: 3 }} ref={hourlyChartRef}>
              {chartDataHourly && (
                <Paper elevation={3} sx={{ p: 3 }}>
                  <Typography 
                    variant="h6" 
                    gutterBottom 
                    sx={{ p: 2, mt: -1, color:'primary.main' }}
                  >
                    Hourly Temperature
                  </Typography>
                  <Line 
                    data={chartDataHourly}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: { 
                          display: false 
                        },
                        title: { 
                          display: true, 
                          text: 'Hourly Temperature' 
                        },
                        datalabels: {
                          display: false // Disable data labels here
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => `${context.dataset.label}: ${context.raw}°C`
                            }
                        }
                      },
                      scales: {
                        x: { 
                          title: { 
                            display: true, 
                            text: 'Hour' 
                          }
                        },
                        y: { 
                          title: { 
                            display: true, 
                            text: 'Temperature (°C)' 
                          } 
                        }
                      }
                    }}
                  />
                </Paper>
              )}
            </Box>

            {/* Button/Tab group */}  

            <Box sx={{ mt: 8, display: 'flex', justifyContent: 'center' }}>             
              <ButtonGroup variant="contained" aria-label="Basic button group">
                <Button
                  onClick={() => setSelectedChartType('temperature')}
                  variant={selectedChartType === 'temperature' ? 'contained' : 'outlined'}
                >
                  Temperature
                </Button>
                <Button
                  onClick={() => setSelectedChartType('precipitation')}
                  variant={selectedChartType === 'precipitation' ? 'contained' : 'outlined'}
                >
                  Precipitation
                </Button>
              </ButtonGroup>
            </Box>
            
            {/* Monthly Bar Charts */}

            <Box sx={{ mt: 3 }} ref={monthlyChartRef}>
              {chartDataTempMonthly && (
                <> {/* Title and handleMonthChange buttons */}  
                  <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                    <Typography 
                        variant="h6" 
                        gutterBottom 
                        sx={{ p: 2, mt: -1, color:'primary.main' }}
                    >
                      Monthly {selectedChartType === 'temperature' ? 'Min and Max Temperatures' : 'Precipitation'}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                      <Button
                        variant="outlined"
                        onClick={() => handleMonthChange(-1)}
                      >
                        ←
                      </Button>
                      <Typography variant="h6" sx={{ mx: 2 }}>
                        {format(currentMonth, 'd MMMM yyyy')}
                      </Typography>
                      <Button
                        variant="outlined"
                        onClick={() => handleMonthChange(1)}
                      >
                        →
                      </Button>
                    </Box>

                    {/* Display Monthly Temperature Chart */} 

                    {selectedChartType === 'temperature' ? (
                      <Line 
                        ref={chartRef} // Attach ref to the chart component
                        data={chartDataTempMonthly}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { 
                              position: 'top' 
                            },
                            title: { 
                              display: true, 
                              text: 'Monthly Min and Max Temperatures' 
                            },
                            zoom: {
                              zoom: {
                                drag: {
                                  enabled: true
                                }
                              }
                            },
                            datalabels: {
                              display: false // Disable data labels here
                            },
                            tooltip: {
                                callbacks: {
                                    label: (context) => {
                                        // If data is an object with x and y, display the y-value
                                        // For the target date's values
                                        if (typeof context.raw === 'object' && context.raw !== null && 'y' in context.raw) {
                                            return `${context.dataset.label}: ${context.raw.y}°C`;
                                        }
                                        // else, for the monthly values
                                        return `${context.dataset.label}: ${context.raw}°C`
                                    }
                                }
                            }
                          },
                          scales: {
                            x: {
                              type: 'time',
                              time: { 
                                unit: 'month',
                                tooltipFormat: 'd MMMM yyyy' 
                              },
                              title: { 
                                display: true, 
                                text: 'Date' 
                              }
                            },
                            y: { 
                              stacked: false,
                              title: { 
                                display: true, 
                                text: 'Temperature (°C)' 
                              } 
                            }
                          }
                        }}
                      />  
                    ) : ( // {/* Display Monthly Precipitation Chart */}
                      <Line 
                        ref={chartRef} // Attach ref to the chart component
                        data={chartDataPrecipitation}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { 
                              position: 'top' 
                            },
                            title: { 
                              display: true, 
                              text: 'Monthly Precipitation' 
                            },
                            zoom: {
                              zoom: {
                                drag: {
                                  enabled: true
                                }
                              }
                            },
                            datalabels: {
                              display: false // Disable data labels here
                            },
                            tooltip: {
                                callbacks: {
                                    label: (context) => {
                                        // If data is an object with x and y, display the y-value
                                        // For the target date's values
                                        if (typeof context.raw === 'object' && context.raw !== null && 'y' in context.raw) {
                                            return `${context.dataset.label}: ${context.raw.y}mm`;
                                        }
                                        // else, for the monthly values
                                        return `${context.dataset.label}: ${context.raw}mm`
                                    }
                                }
                            }
                          },
                          scales: {
                            x: {
                              type: 'time',
                              time: { 
                                unit: 'month',
                                tooltipFormat: 'MMMM yyyy' 
                              },
                              title: { 
                                display: true, 
                                text: 'Date' 
                              }
                            },
                            y: { 
                              title: { 
                                display: true, 
                                text: 'Precipitation (mm)' 
                              } 
                            }
                          }
                        }}
                      />
                    )}

                    {/* Reset Zoom button */}
                    <Box sx={{display: 'flex', justifyContent: 'flex-end' }}>
                        <Button onClick={handleResetZoom} variant="contained" color="secondary" style={{ margin:24 }}>
                            Reset Zoom
                        </Button>
                    </Box>
  
                  </Paper>
                </>
              )}
            </Box>

            {/* Export Charts to PDF button */}
            <Box sx={{ mt: 3, mb: 10, display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={exportToPDF} variant="contained" color="primary" style={{ margin:24 }}>
                    Export to PDF
                </Button>
            </Box>

          </>
          )}
        </Box>
      </Container>
    );
}

export default TemperaturePage;