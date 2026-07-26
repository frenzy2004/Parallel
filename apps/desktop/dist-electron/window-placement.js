const GAP = 16;
const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
export const chooseSidecarBounds = (lasso, display, sidecar) => {
    const displayRight = display.x + display.width;
    const displayBottom = display.y + display.height;
    const y = clamp(lasso.y, display.y, Math.max(display.y, displayBottom - sidecar.height));
    const rightX = lasso.x + lasso.width + GAP;
    if (rightX + sidecar.width <= displayRight) {
        return { x: rightX, y, ...sidecar, placement: "right" };
    }
    const leftX = lasso.x - GAP - sidecar.width;
    if (leftX >= display.x) {
        return { x: leftX, y, ...sidecar, placement: "left" };
    }
    const centeredX = lasso.x + lasso.width / 2 - sidecar.width / 2;
    return {
        x: clamp(centeredX, display.x, Math.max(display.x, displayRight - sidecar.width)),
        y: clamp(lasso.y + lasso.height + GAP, display.y, Math.max(display.y, displayBottom - sidecar.height)),
        ...sidecar,
        placement: "below",
    };
};
//# sourceMappingURL=window-placement.js.map