import React from 'react';
import { Box, AppBar, Toolbar, Tabs, Tab, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';


function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine which tab to show as active
  const currentTab = location.pathname === '/' ? 0 : 1;

  // Handle tab change
  const handleChange = (event, newValue) => {
    if (newValue === 0) {
      navigate('/');
    } else {
      navigate('/weather-type');
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
        <AppBar 
            position="sticky" 
            sx={{ 
                bgcolor: 'background.main',
                color: 'primary.main',
                boxShadow: 3
            }}>
            <Toolbar>
                <Typography 
                    variant="h6" 
                    sx={{ 
                        flexGrow: 1,
                        p: 2
                    }}>
                    Group 9 Nein
                </Typography>
                <Tabs value={currentTab} onChange={handleChange} textColor="inherit" indicatorColor="secondary">
                    <Tab label="Temperature Charts" />
                    <Tab label="Weather Classification" />
                </Tabs>
            </Toolbar>
        </AppBar>
    </Box>
  );
}

export default Navbar;
