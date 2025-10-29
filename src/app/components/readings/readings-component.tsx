"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export default function Readings() {
    const [data, setData] = useState<{ date: Date; value: number | null }[] | null>(null);

    const meterReadingsHeatmap = useRef<SVGSVGElement | null>(null);

    //fetch the data
    useEffect(() => {
        async function fetchAndParseData() {
            try {
                const result = await fetch("https://snapmeter.com/api/public/meters/2080448990211/readings?start=2023-09-01&end=2025-09-01", {
                    headers: {
                        'Authorization': '4f981c43-bf28-404c-ba22-461b5979b359'
                    }
                });

                if (!result.ok) throw new Error(`HTTP Error! status: ${result.status}`);

                const json = await result.json();
                const readings = json.data[0].attributes.readings.kw
                const parsedReadings = Object.entries<number>(readings).map(([timestamp, value]) => ({
                    date: new Date(timestamp),
                    value
                }));

                setData(parsedReadings);
            } catch(err) {
                console.log(err);
            }
        }

        fetchAndParseData();
    }, []);

    //build the heatmap
    useEffect(() => {
        if (!data) return;

        const margins = { top: 20, left: 100, right: 100, bottom: 20 };
        const width = 800;
        const height = 600;

        const svg = d3.select(meterReadingsHeatmap.current)
            .attr("width", width + margins.left + margins.right)
            .attr("height", height + margins.top + margins.bottom) 
            .append("g")
            .attr("transform", `translate(${margins.left}, 0)`);
        svg.selectAll("*").remove();

        const tooltip = d3.select(".heatmap-tooltip");

        const monthlyRollup = d3.rollup(
            data,
            v => d3.mean(v, d => d.value),
            d => d3.timeMonth(d.date),
            d => d.date.getHours()
        );

        const xScale = d3.scaleLinear()
            .domain([0, 23])
            .range([0, width]);

        const xAxis = d3.axisBottom(xScale)
            .ticks(24)
            .tickFormat(d => `${d}:00`);
        
        svg.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0, ${height})`)
            .call(xAxis);

        svg.selectAll(".x-axis text")
            .attr("transform", `translate(${24 / 2}, 0) rotate(-45)`)
            .style("text-anchor", "end");

        const months = [...monthlyRollup.keys()];

        const yScale = d3.scaleBand()
            .domain(months.map(d => d.toISOString()))
            .range([0, height])
            .padding(0.1);

        const yAxis = d3.axisLeft(yScale)
            .tickFormat(d => d3.timeFormat("%b %Y")(new Date(d)));

        svg.append("g")
            .attr("class", "y-axis")
            .call(yAxis);

        const colorScheme = d3.scaleSequential(d3.interpolateRdPu)
            .domain(d3.extent(data, d => d.value) as [number, number]);

        monthlyRollup.forEach((hourMap, month) => {
            hourMap.forEach((value, hour) => {
                const v = value ?? 0;
                svg.append("rect")
                    .attr("x", xScale(hour))
                    .attr("y", yScale(month.toISOString())?? 0)
                    .attr("width", (width / (24)) - 2)
                    .attr("height", yScale.bandwidth())
                    .attr("fill", colorScheme(v))
                    .on("mouseover", function(event) {
                        tooltip
                            .style("display", "block")
                            .html(`Month: ${d3.timeFormat("%b %Y")(new Date(month.toISOString()))} <br>Hour: ${hour}:00<br>Value: ${v.toFixed(2)}`)
                            .style("left", `${event.pageX + 10}px`)
                            .style("top", `${event.pageY - 20}px`);
                    })
                    .on("mousemove", function(event) {
                        tooltip
                            .style("left", `${event.pageX + 10}px`)
                            .style("top", `${event.pageY - 20}px`);
                    })
                    .on("mouseout", function() {
                        tooltip.style("display", "none");
                    });
            })
        });

    }, [data]);
    
    return (
        <div>
            <h1 className="heatmap-header">Meter Readings</h1>
            <div className="heatmap-tooltip"></div>
            <svg ref={meterReadingsHeatmap} width={800} height={600}></svg>
        </div>
    );
}
