export function drawFormalAnnotations(svg, xScale, width, height, annotations) {
  if (!svg || !xScale) return;

  const annotationLayer = svg.selectAll('.formal-annotations-layer').data([null]);
  const annotationLayerEnter = annotationLayer.enter().append('g')
    .attr('class', 'formal-annotations-layer');
  const annotationLayerUpdate = annotationLayerEnter.merge(annotationLayer);
  annotationLayerUpdate.selectAll('*').remove();

  const domain = xScale.domain();
  annotations.forEach(ann => {
    const startX = xScale(ann.start);
    const endX = xScale(ann.end);
    const measureX = xScale(ann.measure);

    const isSectionInView = ann.type === 'section' && ann.end > domain[0] && ann.start < domain[1];
    const isMarkerInView = ann.type === 'marker' && ann.measure >= domain[0] && ann.measure <= domain[1];

    if (isSectionInView) {
      const drawStartX = Math.max(0, startX);
      const drawEndX = Math.min(width, endX);
      const drawWidth = Math.max(0, drawEndX - drawStartX);

      if (drawWidth > 0) {
        annotationLayerUpdate.append('rect')
          .attr('x', drawStartX).attr('y', -60)
          .attr('width', drawWidth).attr('height', 20)
          .attr('fill', ann.color).attr('opacity', 0.3);

        const midMeasure = (ann.start + ann.end) / 2;
        const midX = xScale(midMeasure);
        if (midX >= 0 && midX <= width) {
          annotationLayerUpdate.append('text')
            .attr('x', midX).attr('y', -45)
            .text(ann.label).attr('fill', ann.color)
            .attr('font-size', 10).attr('text-anchor', 'middle')
            .style('pointer-events', 'none');
        }
      }
    } else if (isMarkerInView) {
      if (measureX >= 0 && measureX <= width) {
        annotationLayerUpdate.append('line')
          .attr('x1', measureX).attr('x2', measureX)
          .attr('y1', -60).attr('y2', height)
          .attr('stroke', ann.color).attr('stroke-width', 1)
          .attr('stroke-dasharray', '2,2');
        annotationLayerUpdate.append('text')
          .attr('x', measureX + 3).attr('y', -65).text(ann.label)
          .attr('fill', ann.color).attr('font-size', 10)
          .style('pointer-events', 'none');
      }
    }
  });
}
