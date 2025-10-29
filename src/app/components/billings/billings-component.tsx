"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

interface BillVariance {
    category: string;
    value: number;
    signedValue: number;
    percentValue: number;
    sign: "positive" | "negative";
}

interface ParsedBill {
    startDate: string;
    endDate: string;
    cost: number;
    use: number;
    variances: BillVariance[];
}

export default function Billings() {
    const [data, setData] = useState<ParsedBill[]>([]);
    const billsBarStack = useRef<SVGSVGElement | null>(null);

    //fetch data
    useEffect(() => {
        async function fetchAndParseData() {
            try {
                const result = await fetch("https://snapmeter.com/api/public/services/2080448990210/bills?start=2023-09-01&end=2025-09-01", {
                    headers: {
                        'Authorization': '4f981c43-bf28-404c-ba22-461b5979b359'
                    }
                });

                if (!result.ok) throw new Error(`HTTP Error! status: ${result.status}`);
                const json = await result.json();
                const parsedBills = json.data.map((bill: any) => ({
                    startDate: bill.attributes.start,
                    endDate: bill.attributes.end,
                    cost: bill.attributes.cost,
                    use: bill.attributes.use,
                    variances: bill.attributes.billVariances.variances.map((v: {
                        category: string,
                        absoluteVariance: number,
                        percentVariance: number
                    }) => ({
                        category: v.category,
                        value: Math.abs(v.absoluteVariance),
                        signedValue: v.absoluteVariance,
                        percentValue: v.percentVariance,
                        sign: v.absoluteVariance >= 0 ? "positive" : "negative" 
                    }))
                }));
            
                setData(parsedBills);
            } catch(err) {
                console.log(err);
            }
        }

        fetchAndParseData();
    }, []);

    //build stacked bar plot 
    useEffect(() => {
        if (!data || !data.length) return;

        const margins = { top: 20, left: 100, right: 100, bottom: 120 };
        const width = 800;
        const height = 600;

        const svg = d3.select(billsBarStack.current)
            .attr("width", width + margins.left + margins.right)
            .attr("height", height + margins.top + margins.bottom) 
            .append("g")
            .attr("transform", `translate(${margins.left}, ${margins.top})`);
        svg.selectAll("*").remove();

        const categories = data[0]?.variances.map(v => v.category);
        const tooltip = d3.select(".bar-stack-tooltip");

        const xScale = d3.scaleBand()
            .domain(data.map(d => d.startDate))
            .range([0, width])
            .padding(0.1);

        const xAxis = d3.axisBottom(xScale)
            .tickFormat((d, i) => {
                const bill = data[i]
                return `${bill.startDate} - ${bill.endDate}`;
            });
        
        svg.append("g")
            .attr("class", "x-axis-stack")
            .attr("transform", `translate(0, ${height})`)
            .call(xAxis);

        svg.selectAll(".x-axis-stack text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end")
            .attr("dx", "-0.5em")
            .attr("dy", "0.5em");

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => d3.sum(d.variances, v => Math.abs(v.value))) ?? 0])
            .nice()
            .range([height, 0]);

        const yAxis = d3.axisLeft(yScale);

        svg.append("g")
            .attr("class", "y-axis-stack")
            .call(yAxis);

        const color = d3.scaleOrdinal() 
            .domain(data[0].variances.map(v => v.category))
            .range(d3.schemePastel1);

        const stack = d3.stack<ParsedBill, string>()
            .keys(categories)
            .value((d, key) => {
                const found = d.variances.find(v => v.category === key);
                return found ? Math.abs(found.value) : 0;
            });

        const stackedData = stack(data);

        svg.selectAll(".stack-layer")
            .data(stackedData)
            .enter()
            .append("g")
            .attr("class", "stack-layer")
            .attr("fill", (d: d3.Series<ParsedBill, string>) => color(d.key) as string)
            .selectAll("rect")
            .data(d => d.map((v, i) => ({
                key: d.key,
                bill: data[i],
                y0: v[0],
                y1: v[1]
            })))
            .enter()
            .append("rect")
            .attr("x", d => xScale(d.bill.startDate) ?? 0)
            .attr("y", d => yScale(d.y1))
            .attr("height", d => yScale(d.y0) - yScale(d.y1))
            .attr("width", xScale.bandwidth());

        svg.selectAll("rect")
            .on("mouseover", function(event, d) {
                const datum = d as { key: string, bill: ParsedBill, y0: number, y1: number};
                const variance = datum.bill.variances.find(v => v.category === datum.key)!;
                tooltip
                    .style("display", "block")
                    .html(`<strong>${datum.bill.startDate}</strong> to <strong>${datum.bill.endDate}</strong><br>Total Cost: $ ${datum.bill.cost}<br>Total Use: ${datum.bill.use} kWh<br><strong>Variance in ${datum.key}</strong>:<br>${Math.round(variance.signedValue)} kWh`)
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

    }, [data]);

    return (
        <div>
            <h1 className="bar-stack-header">Billing Variances</h1>
            <div className="bar-stack-tooltip"></div>
            <svg ref={billsBarStack} width={800} height={600}></svg>
        </div>
    );
}
