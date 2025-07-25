import React, { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, TimeScale } from 'chart.js';
import 'chartjs-adapter-date-fns'; // Import the date adapter
import { addMonths, subMonths, format, parse } from 'date-fns';
import { 
  Container, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  Grid,
  Box,
  CircularProgress,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

// Registering Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, TimeScale);

const theme = createTheme({
  palette: {
    contrastThreshold: 4.5,
    primary: {
      main: '#02154F',
      light: 'rgba(2, 21, 79, 0.56)',
      dark: '#394873', //hover effect
      contrastText: '#F3FEFD',
    },
    secondary: {
      main: '#B2E0EC',
      dark: '#54B6D3',
      contrastText: '#02154F',
    },
    error: {
      main: '#CB4904',
      light: '#FFC261',
    }
  },
});

const useErrorLog = () => {
  return useCallback((error, info) => {
    console.error("Error occurred:", error, info);
    // Here you could send error logs to a service like Sentry

    // Example: Send error to an external service like Sentry
    // Sentry.captureException(error);

    // Example: Send error to a custom API
    // axios.post('/api/log', { error: error.toString(), info });
  }, []);
};

export default function App() {
  const errorLog = useErrorLog();
  const [target_date, setDate] = useState('');
  const [predictedMinTemp, setPredictedMinTemp] = useState(null);
  const [predictedMaxTemp, setPredictedMaxTemp] = useState(null);
  const [predictedHourlyTemps, setPredictedHourlyTemps] = useState(null);
  const [chartDataMonthly, setChartDataMonthly] = useState(null);
  const [chartDataHourly, setChartDataHourly] = useState(null);
  const [dateRange, setDateRange] = useState([]);
  //const [chartData, setChartData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const hourlyChartRef = useRef(null);
  const monthlyChartRef = useRef(null);
  // Function to parse a string date in 'YYYY-MM-DD' format
  function parseDate(target_date) {
    // Split date string by "-" and construct a new Date object
    const [year, month, day] = target_date.split("-").map(Number);
    return new Date(year, month - 1, day); // JS Date months are zero-indexed
  }

  // Generate a Dynamic Date Range Based on target date
  const createDateRange = (targetDate) => {
    const dates = [];
    let startDate = subMonths(new Date(targetDate), 3); // Start 3 months before the target date
    let endDate = addMonths(new Date(targetDate), 3);   // End 3 months after the target date
  
    while (startDate <= endDate) {
      dates.push(format(startDate, 'yyyy-MM-dd'));
      startDate = addMonths(startDate, 1);
    }
    return dates;
  };
  
  // const createMonthRange = () => {
  //   const dates = [];
  //   let startDate = subMonths(new Date(), 12); // 1 year before today
  //   const endDate = addMonths(new Date(), 3);  // 3 months after today
  
  //   while (startDate <= endDate) {
  //     dates.push(format(startDate, 'yyyy-MM')); // Format to 'yyyy-MM'
  //     startDate = addMonths(startDate, 1);
  //   }
  
  //   return dates;
  // };


  
  const handleMonthChange = (increment) => {
    const newDate = format(addMonths(new Date(target_date), increment), 'yyyy-MM-dd');// Increment or decrement month
    setDate(newDate);
    setCurrentMonth(addMonths(currentMonth, increment));
    fetchDataForDateRange(newDate);
  };
  // Axios Call
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setPredictedMinTemp(null);
    setPredictedMaxTemp(null);
    setPredictedHourlyTemps(null);
    setChartDataMonthly(null); // Reset chart data
    setChartDataHourly(null); // Reset chart data
    setLoading(true);

    try {
      // Axios call to predict temperatures
      // Validate the target date by sending a POST request
      await axios.post(`http://localhost:8000/predict`, { target_date });

      const response = await axios.get(`http://localhost:8000/predict/${target_date}`);
      setPredictedMinTemp(response.data.predicted_mintemp);
      setPredictedMaxTemp(response.data.predicted_maxtemp);
      setPredictedHourlyTemps(response.data.hourly_temperatures);

      // Prepare data for the chart
      // Use the createDateRange function
      const Days = createDateRange(target_date); // Returns an array of dates around target_date
      setDateRange(Days);
      
      const predictions = await Promise.all(
        Days.map(async (sf) => {
          const res = await axios.get(`http://localhost:8000/predict/${sf}`);
          return {
            mintemp: res.data.predicted_mintemp,
            maxtemp: res.data.predicted_maxtemp,
            
          };
        })
      );

      
      // Chart.js Integration
      // Creating the chart data using the predictions from the backend
      const newChartDataMonthly = {
        labels: Days.map(parseDate), // X-axis labels
        datasets: [
          {
            label: 'Monthly Min Temp',
            data: predictions.map((p) => p.mintemp),
            borderColor: 'rgb(84, 182, 211)',
            backgroundColor: 'rgba(84, 182, 211, 0.4)',
            stack: 'combined',
            type: 'bar',
            order: 1,
            tension: 0.1
          },
          {
            label: 'Monthly Max Temp',
            data: predictions.map((p) => p.maxtemp),
            borderColor: 'rgb(255, 194, 97)',
            backgroundColor: 'rgba(255, 194, 97, 0.4)',
            stack: 'combined',
            type: 'bar',
            order: 1,
            tension: 0.1
          },
          {
            label: "Target Date's Min Temp",
            data: [{x: parseDate(target_date), y: response.data.predicted_mintemp}],
            borderColor: 'rgb(64, 134, 155)',
            backgroundColor: 'rgba(64, 134, 155, 0.4)',
            pointRadius: 8,
            pointHoverRadius: 12,
            order: 0,
            showLine: false // Show only the point for the user's prediction
          },
          {
            label: "Target Date's Max Temp",
            data: [{x: parseDate(target_date), y: response.data.predicted_maxtemp}],
            borderColor: 'rgb(242, 150, 59)',
            backgroundColor: 'rgba(242, 150, 59, 0.4)',
            pointRadius: 8,
            pointHoverRadius: 12,
            order: 0,
            showLine: false // Show only the point for the user's prediction
          }
        ]
      };
      console.log(chartDataMonthly);
      setChartDataMonthly(newChartDataMonthly); // Set the chart data in state

      // predictedHourlyTemp is null
      const hourlyLabels = response.data.hourly_temperatures.map((item) => `${item.hour}:00`);
      const hourlyData = response.data.hourly_temperatures.map((item) => item.temperature);
      

        const newChartDataHourly = {
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
        };
        setChartDataHourly(newChartDataHourly); // Set the chart data in state

        //setChartData(newChartDataMonthly); 

      if (response.data.hourly_temperatures && response.data.hourly_temperatures.length) {
       
      }

    } catch (err) {
      setError('Error predicting temperature. Please try again.');
      errorLog(err, 'Error predicting temperature');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDataForDateRange = async (targetDate) => {
        setError('');
        setPredictedMinTemp(null);
        setPredictedMaxTemp(null);
        setLoading(true);      
        const startDate = subMonths(new Date(targetDate), 3);
        const endDate = addMonths(new Date(targetDate), 3);
        const dateRange = [];
        let current = startDate;
        while (current <= endDate) {
        dateRange.push(format(current, 'yyyy-MM-dd'));
        current = addMonths(current, 1);
   }
        // const previousMonthDate = format(subMonths(new Date(targetDate), 1), 'yyyy-MM-dd');// Format month for request
        // const currentDate = format(new Date(targetDate), 'yyyy-MM-dd');// Format month for request
        // const nextMonthDate = format(addMonths(new Date(targetDate), 1), 'yyyy-MM-dd');// Format month for request
      try {

        const responses = await Promise.all(
          dateRange.map((date) =>
            axios.get(`http://localhost:8000/predict/${date}`)));

        // Update the predicted min and max temperature state
        const data = responses.map((response) => response.data);
        
        // setPredictedMinTemp(data.predicted_mintemp);
        // setPredictedMaxTemp(data.predicted_maxtemp);
        const newChartDataMonthly = {
          labels: dateRange,
          datasets: [
            {
              label: 'Min Temp',
              data: data.map((d) => d.predicted_mintemp),
              backgroundColor: 'rgba(84, 182, 211, 0.4)',
              stack: 'combined',
              type: 'bar',
              tension: 0.1
            },
            {
              label: 'Max Temp',
              data: data.map((d) => d.predicted_maxtemp),
              backgroundColor: 'rgba(255, 194, 97, 0.4)',
              stack: 'combined',
              type: 'bar',
              tension: 0.1
            },
            {
              label: "Target Date's Min Temp",
              data: [{ x: parseDate(targetDate), y: data.find(d => format(new Date(d.date), 'yyyy-MM-dd') === targetDate).predicted_mintemp }],
              borderColor: 'rgb(64, 134, 155)',
              backgroundColor: 'rgba(64, 134, 155, 0.4)',
              pointRadius: 8,
              pointHoverRadius: 12,
              order: 0,
              showLine: false // Show only the point for the user's prediction
            },
            {
              label: "Target Date's Max Temp",
              data: [{ x: parseDate(targetDate), y: data.find(d => format(new Date(d.date), 'yyyy-MM-dd') === targetDate).predicted_maxtemp }],
              borderColor: 'rgb(242, 150, 59)',
              backgroundColor: 'rgba(242, 150, 59, 0.4)',
              pointRadius: 8,
              pointHoverRadius: 12,
              order: 0,
              showLine: false // Show only the point for the user's prediction
            }
          ]
        };
        setChartDataMonthly(newChartDataMonthly);

      } catch (err) {
        setError('Error fetching data for the month.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    const createHourlyChartData = (hourlyTemps) => ({
      labels: hourlyTemps.map((item) => `${item.hour}:00`),
      datasets: [
        {
          label: 'Hourly Temperature',
          data: hourlyTemps.map((item) => item.temperature),
          borderColor: 'rgb(84, 182, 211)',
          backgroundColor: 'rgba(84, 182, 211, 0.2)',
          fill: true,
          tension: 0.1
        }
      ]
    });
  
    const exportToPDF = async () => {
      const pdf = new jsPDF();
      const hourlyCanvas = await html2canvas(hourlyChartRef.current);
      const monthlyCanvas = await html2canvas(monthlyChartRef.current);
  
      const hourlyImageData = hourlyCanvas.toDataURL('image/png');
      const monthlyImageData = monthlyCanvas.toDataURL('image/png');
  
      pdf.text("Weather Forecast", 10, 10);
      pdf.addImage(hourlyImageData, 'PNG', 10, 20, 180, 80);
      pdf.addPage();
      pdf.addImage(monthlyImageData, 'PNG', 10, 20, 180, 80);
      pdf.save("weather_forecast.pdf");
    };
  


  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <Container maxWidth="md">
          <Box sx={{ my: 4 }}>
            <Typography variant="h3" component="h1" gutterBottom>
              Melbourne Weather Forecast
            </Typography>
          </Box>
          <Box sx={{ my: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Daily Temperature Forecast
            </Typography>
            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
              <form onSubmit={handleSubmit}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="date"
                      variant="outlined"
                      value={target_date}
                      onChange={(e) => setDate(e.target.value)}
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
              <Typography color="error" sx={{ mb: 2 }}>
                {error}
              </Typography>
            )}
            <Box sx={{ mt: 3 }}>
            {predictedMinTemp && predictedMaxTemp && (
              <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5" gutterBottom>
                  Min: <b>{predictedMinTemp.toLocaleString()}°C</b> <br />
                  Max: <b>{predictedMaxTemp.toLocaleString()}°C</b>
                </Typography>
              </Paper>
            )}
            </Box>

            <Box sx={{ mt: 3 }} ref={hourlyChartRef}>
              {chartDataHourly && (
                <Paper elevation={3} sx={{ p: 3 }}>
                  <Typography variant="h6">Hourly Temperature</Typography>
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

            
            <Box sx={{ mt: 3 }} ref={monthlyChartRef}>
            {chartDataMonthly && (
              <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6">Monthly Min and Max Temperatures</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => handleMonthChange(-1)}
                  >
                    -
                  </Button>
                  <Typography variant="h6" sx={{ mx: 2 }}>
                    {format(currentMonth, 'MMMM yyyy')}
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={() => handleMonthChange(1)}
                  >
                    +
                  </Button>
                </Box>
                

                <Line 
                  data={chartDataMonthly}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { 
                        position: 'top' 
                      },
                      title: { 
                        display: true, 
                        text: 'Monthly Min and Max Temperatures' 
                      }
                    },
                    scales: {
                      x: {
                        type: 'time',
                        time: { 
                          unit: 'month',
                          tooltipFormat: 'dd/MM/yyyy' 
                        },
                        title: { 
                          display: true, 
                          text: 'Date' 
                        },
                        
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
              </Paper>
            )}
            </Box>
          <Button onClick={exportToPDF} variant="contained" color="primary" style={{ marginTop: '20px' }}>
            Export to PDF
          </Button>
      
  
        

          </Box>
        </Container>
      </ThemeProvider>
    </ErrorBoundary>
  );
};


class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.log(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }
    return this.props.children;
  }
}