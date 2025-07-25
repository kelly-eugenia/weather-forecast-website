import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import axios from 'axios';

const WeatherChart = () => {
    const [startdate, setStartDate] = useState(null);
    const [enddate, setEndDate] = useState(null);
    const [weatherData, setWeatherData] = useState({});
    const chartRef = useRef();

    // Reference to hold previous values across renders
    const initialStartDate = useRef(null);
    const initialEndDate = useRef(null);
  
    const handleSubmit = async (e) => {
      e.preventDefault();

      // If a date has not been updated, use the previous value
      const finalStartDate = startdate || initialStartDate.current;
      const finalEndDate = enddate || initialEndDate.current;

      // Update the refs with the latest values
      initialStartDate.current = finalStartDate;
      initialEndDate.current = finalEndDate;
      
      try {
        await axios.post(`http://localhost:8000/predict_weather`, { startdate, enddate });

        const response = await axios.get(`http://localhost:8000/predict_weather/${startdate}/${enddate}`);
        
        setWeatherData(response.data.weather_counts);
        
      } catch (error) {
        console.error("Error fetching weather data:", error);
      }
    };

    useEffect(() => {
        console.log("Updated weatherData:", weatherData);
        if (weatherData) {
          renderPieChart(weatherData);
        }
    }, [weatherData]);
    
    const renderPieChart = (data) => {
        const container = d3.select(chartRef.current);
        const width = container.node().getBoundingClientRect().width;
        const height = container.node().getBoundingClientRect().height;
        const radius = Math.min(width, height) / 2;

        // Clear previous SVG content
        d3.select(chartRef.current).selectAll("*").remove();

        const color = d3.scaleOrdinal(d3.schemeCategory10);
        const pie = d3.pie().value((d) => d[1]);
        const arc = d3.arc().innerRadius(0).outerRadius(radius);

        const svg = d3
            .select(chartRef.current)
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${width / 2}, ${height / 2})`);

        const arcs = svg.selectAll('arc')
            .data(pie(Object.entries(data)))
            .enter()
            .append('g')
            .attr('class', 'arc');

        arcs.append('path')
            .attr('d', arc)
            .attr('fill', (d) => color(d.data[0]));

        arcs.append('text')
            .attr('transform', (d) => `translate(${arc.centroid(d)})`)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .text((d) => `${d.data[0]}: ${d.data[1]}`);
    };
    
    return (
    <div>
        <form onSubmit={handleSubmit}>
        <label>
            Start Date:
            <input
            type="date"
            value={startdate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            />
        </label>
        <label>
            End Date:
            <input
            type="date"
            value={enddate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            />
        </label>
        <button type="submit">Submit</button>
        </form>
        <svg ref={chartRef} />
    </div>
    );
};
    
export default WeatherChart;