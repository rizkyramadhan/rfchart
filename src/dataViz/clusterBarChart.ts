import * as d3 from 'd3';
import { formatNumber } from './Utils';

export interface Datum {
  groupName: string;
  x: string;
  y: number;
  fill?: string;
  tooltipContent?: string;
  tooltipContentOnly?: boolean;
  onClick?: () => void;
  onMouseMove?: (d: Datum, coords: { x: number, y: number }) => void;
  onMouseLeave?: (d: Datum, coords: { x: number, y: number }) => void;
}

interface Dimensions {
  width: number;
  height: number;
}

interface Input {
  svg: d3.Selection<any, unknown, null, undefined>;
  tooltip: d3.Selection<any, unknown, null, undefined>;
  data: Datum[];
  size: Dimensions;
  axisLabels?: { left?: string, bottom?: string };
  labelFont?: string;
  axisMinMax?: {
    minY?: number,
    maxY?: number,
  };
  formatAxis?: {
    y?: (n: number) => string;
  };
  animateAxis?: {
    animationDuration: number,
    startMinY: number,
    startMaxY: number,
  };
  tickCount?: {
    x?: number;
    y?: number;
  };
  animateBars?: number;
}

export default (input: Input) => {
  const {
    svg, size, axisLabels, data, tooltip, labelFont, formatAxis,
    animateAxis, tickCount, axisMinMax, animateBars,
  } = input;

  const margin = {
    top: 30, right: 30,
    bottom: axisLabels && axisLabels.bottom ? 60 : 30,
    left: 30
  };
  const width = size.width - margin.left - margin.right;
  const height = size.height - margin.bottom - margin.top;

  const color = d3.scaleOrdinal(d3.schemeCategory10);

  // set the ranges
  const x = d3.scaleBand().rangeRound([0, width])
    .padding(0.1);
  const y = d3.scaleLinear().range([height, 0]);

  const g = svg.append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  const rawMinY = axisMinMax && axisMinMax.minY !== undefined
    ? axisMinMax.minY
    : d3.min(data, function (d) {
      return d.y;
    });
  const rawMaxY = axisMinMax && axisMinMax.maxY !== undefined
    ? axisMinMax.maxY
    : d3.max(data, function (d) {
      return d.y;
    });
  const minY = rawMinY ? Math.floor(rawMinY * 0.8) : 0;
  const maxY = rawMaxY && rawMaxY > 0.1 ? Math.ceil(rawMaxY * 1.05) : 0.1;

  y.domain([minY, maxY]);
  x.domain(data.map(function (d) {
    return d.x;
  }));

  const x1 = d3.scaleBand()
    .rangeRound([0, x.bandwidth()])
    .padding(0.05)
    .domain(data.map(function (d) {
      return d.groupName;
    }));

  color.domain(data.map(function (d) {
    return d.groupName;
  }));

  const groups = g.selectAll(null)
    .data(data)
    .enter()
    .append('g')
    .attr('transform', function (d) {
      return 'translate(' + x(d.x) + ',0)';
    });

  groups.selectAll(null)
    .data(function (d) {
      return [d];
    })
    .enter()
    .append('rect')
    .attr('x', function (d) {
      const xVal = x1(d.groupName);
      return xVal ? xVal : 0;
    })
    .attr('width', x1.bandwidth())
    .attr('fill', d => d.fill ? d.fill : color(d.groupName))
    .style('cursor', ({ onClick }) => onClick ? 'pointer' : 'default')
    .on('mousemove', d => {
      const { groupName, x: valueName, tooltipContent, tooltipContentOnly, onMouseMove } = d;
      if (onMouseMove) {
        onMouseMove(d, { x: (d3 as any).event.pageX, y: (d3 as any).event.pageY })
      } else {
        if (tooltipContentOnly && tooltipContent && tooltipContent.length) {
          tooltip.html(tooltipContent);
        } else {
          const content = tooltipContent === undefined || tooltipContent.length === 0
            ? '' : `:<br />${tooltipContent}`;
          tooltip.html(`<strong>${groupName}, ${valueName}</strong>${content}`);
        }
        tooltip
          .style('display', 'block')
          .style('transform', 'translate(-50%, -100%)')
          .style('left', ((d3 as any).event.pageX + 4) + 'px')
          .style('top', ((d3 as any).event.pageY - 4) + 'px');
      }
    })
    .on('mouseout', d => {
      if (d.onMouseLeave) {
        d.onMouseLeave(d, { x: (d3 as any).event.pageX, y: (d3 as any).event.pageY })
      } else {
        tooltip
          .style('display', 'none');
      }
    })
    .on('click', ({ onClick }) => onClick ? onClick() : undefined)
    .attr('y', height)
    .transition() // Call Transition Method
    .duration(animateBars ? animateBars : 0) // Set Duration timing (ms)
    .delay(animateAxis && animateAxis.animationDuration ? animateAxis.animationDuration : 0)
    .attr('y', function (d) {
      return y(d.y);
    })
    .attr('height', function (d) {
      return height - y(d.y);
    })


  const formatY: any = formatAxis && formatAxis.y ? formatAxis.y : formatNumber;
  let yDomain = d3.axisLeft(y);
  if (animateAxis !== undefined) {
    const {
      startMinY, startMaxY,
    } = animateAxis;
    const startY = d3.scaleLinear().range([height, 0]);
    // Scale the range of the data
    startY.domain([startMinY, startMaxY]);

    // xDomain = d3.axisBottom(startX);
    yDomain = d3.axisLeft(startY);
  }


  function truncate(text: any, width: number) {
    const ellipsisWidthAndPadding = 12; // empirically measured width of ... with padding
    text.each(function () {
      // @ts-ignore
      const text = d3.select(this);
      const letters = text.text().split('').reverse();
      let label: string | undefined;
      let line: string[] = [];
      const y = text.attr("y");
      const dy = parseFloat(text.attr("dy"));
      const tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
      while (label = letters.pop()) {
        line.push(label);
        const textValue = line.join("");
        tspan.text(textValue);
        const node = tspan.node();
        if (node && node.getComputedTextLength() > width - ellipsisWidthAndPadding) {
          tspan.text(textValue + '...');
          break;
        }
      }
    });
  }

  // Add the x Axis
  g.append('g')
    .attr('class', 'cluster-bar-char-x-axis')
    .attr('transform', 'translate(0,' + height + ')')
    .style('font-family', labelFont ? labelFont : "'Source Sans Pro',sans-serif")
    .call(d3.axisBottom(x))
    .selectAll(".tick text")
    .call(truncate, x.bandwidth());

  // Add the y Axis
  g.append('g')
    .attr('class', 'cluster-bar-chart-y-axis')
    .style('font-family', labelFont ? labelFont : "'Source Sans Pro',sans-serif")
    .call(yDomain.tickFormat(formatY).ticks(tickCount && tickCount.y ? tickCount.y : 10));

  if (animateAxis !== undefined) {
    (g.selectAll('.cluster-bar-chart-y-axis')
      .transition()
      .duration(animateAxis.animationDuration) as any)
      .call(d3.axisLeft(y).tickFormat(formatY).ticks(tickCount && tickCount.y ? tickCount.y : 10));

    (g.selectAll('.cluster-bar-char-x-axis text')
      .style('fill', 'rgba(0, 0, 0, 0)')
      .transition()
      .duration(animateAxis.animationDuration) as any)
      .style('fill', 'rgba(0, 0, 0, 1)')
      .call(d3.axisBottom(x))
      .selectAll(".tick text")
      .call(truncate, x.bandwidth());
  }

  // append Y axis label
  g.append('g')
    .append('text')
    .attr('class', 'cluster-bar-chart-y-axis-label')
    .attr('y', -margin.top / 2)
    .attr('x', 0)
    .attr('dy', '0.75em')
    .attr('fill', '#000')
    .attr('text-anchor', 'start')
    .style('font-family', labelFont ? labelFont : "'Source Sans Pro',sans-serif")
    .text(axisLabels && axisLabels.left ? axisLabels.left : '');

};
