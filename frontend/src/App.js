import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'; //  Handle page navigation
import { Container, Typography, Box, } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

// Import the pages and navigation bar components
import TemperaturePage from './TemperaturePage';
import WeatherTypePage from './WeatherTypePage';
import NavBar from './NavBar';

// Define custom theme for MUI components
const theme = createTheme({
  palette: {
    contrastThreshold: 4.5,
    primary: {
      main: '#02154F',
      light: 'rgba(2, 21, 79, 0.56)',
      dark: '#394873',
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
    },
    background: {
      main: '#F3FEFD'
    }
  },
});

// Main App component
export default function App() {
  return (
    <ErrorBoundary>   {/* Wraps all components in ErrorBoundary for catching errors */}
      <ThemeProvider theme={theme}>   {/* Provides theme to all child components */}
        <Container maxWidth="xl" disableGutters>
          <Router>  {/* Sets up routing for the application */}
            <NavBar />  {/* Navigation bar to switch between pages */}
            <Box sx={{
                p: 8,
                background: 'linear-gradient(to right bottom, #F3FEFD, #B2E0EC, #FFC261)'
              }}>
              <Typography 
                variant="h3" 
                gutterBottom 
                sx={{ 
                  textAlign: 'center', 
                  color: 'primary.main',
                  p: 4,
                  fontWeight: 'bold'
                }}>
                Melbourne Weather Forecast
              </Typography>
            </Box>
            <Routes>
              <Route path="/" element={<TemperaturePage />} />  {/* Home page displaying temperature and precipitation data */}
              <Route path="/weather-type" element={<WeatherTypePage />} />  {/* Page showing weather types classification */}
            </Routes>
          </Router>
        </Container>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

// ErrorBoundary class to catch JavaScript errors in the component tree
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  // Update state to show fallback UI in case of an error
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  // Log error information for debugging
  componentDidCatch(error, errorInfo) {
    console.log(error, errorInfo);
  }

  render() {
    // Display fallback UI if an error has occurred
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }
    // Otherwise, render the children components as usual
    return this.props.children;
  }
}