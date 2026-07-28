import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

export function LiquidMetalButton({
  label = "Get Started",
  onClick,
  viewMode = "text",
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [ripples, setRipples] = useState([]);
  const canvasRef = useRef(null);
  const buttonRef = useRef(null);
  const rippleId = useRef(0);
  const animFrameRef = useRef(null);

  const dimensions = useMemo(() => {
    if (viewMode === "icon") {
      return {
        width: 46,
        height: 46,
        innerWidth: 42,
        innerHeight: 42,
        shaderWidth: 46,
        shaderHeight: 46,
      };
    }
    return {
      width: 142,
      height: 46,
      innerWidth: 138,
      innerHeight: 42,
      shaderWidth: 142,
      shaderHeight: 46,
    };
  }, [viewMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let t = 0;

    const render = () => {
      t += isHovered ? 0.05 : 0.02;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const grad = ctx.createLinearGradient(0, 0, w, h);
      const shift = Math.sin(t) * 0.2;
      grad.addColorStop(0, "#1a1a1a");
      grad.addColorStop(Math.min(1, Math.max(0, 0.3 + shift)), "#3a3a3a");
      grad.addColorStop(Math.min(1, Math.max(0, 0.6 + shift)), "#121212");
      grad.addColorStop(1, "#2a2a2a");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 100);
      ctx.fill();

      // Liquid sheen overlay
      const sheenGrad = ctx.createRadialGradient(
        w / 2 + Math.cos(t) * (w / 3),
        h / 2 + Math.sin(t) * (h / 3),
        2,
        w / 2,
        h / 2,
        w / 1.5
      );
      sheenGrad.addColorStop(0, "rgba(255, 255, 255, 0.25)");
      sheenGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.05)");
      sheenGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = sheenGrad;
      ctx.fill();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isHovered]);

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsPressed(false);
  };

  const handleClick = (e) => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const ripple = { x, y, id: rippleId.current++ };

      setRipples((prev) => [...prev, ripple]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== ripple.id));
      }, 600);
    }
    onClick?.(e);
  };

  return (
    <div className="relative inline-block" style={{ verticalAlign: "middle" }}>
      <div style={{ perspective: "1000px", perspectiveOrigin: "50% 50%" }}>
        <div
          style={{
            position: "relative",
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
            transformStyle: "preserve-3d",
            transition:
              "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.4s ease, height 0.4s ease",
            transform: "none",
          }}
        >
          {/* Label / Icon Layer */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: `${dimensions.width}px`,
              height: `${dimensions.height}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transformStyle: "preserve-3d",
              transition:
                "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.4s ease, height 0.4s ease, gap 0.4s ease",
              transform: "translateZ(20px)",
              zIndex: 30,
              pointerEvents: "none",
            }}
          >
            {viewMode === "icon" && (
              <Sparkles
                size={16}
                style={{
                  color: "#e2e8f0",
                  filter: "drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.5))",
                  transition: "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  transform: "scale(1)",
                }}
              />
            )}
            {viewMode === "text" && (
              <span
                style={{
                  fontSize: "14px",
                  color: "#ffffff",
                  fontWeight: 600,
                  textShadow: "0px 1px 3px rgba(0, 0, 0, 0.8)",
                  transition: "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  transform: "scale(1)",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            )}
          </div>

          {/* Inner Surface */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: `${dimensions.width}px`,
              height: `${dimensions.height}px`,
              transformStyle: "preserve-3d",
              transition:
                "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.4s ease, height 0.4s ease",
              transform: `translateZ(10px) ${
                isPressed ? "translateY(1px) scale(0.98)" : "translateY(0) scale(1)"
              }`,
              zIndex: 20,
            }}
          >
            <div
              style={{
                width: `${dimensions.innerWidth}px`,
                height: `${dimensions.innerHeight}px`,
                margin: "2px",
                borderRadius: "100px",
                background: "linear-gradient(180deg, #2a2a2a 0%, #111111 100%)",
                boxShadow: isPressed
                  ? "inset 0px 2px 4px rgba(0, 0, 0, 0.6), inset 0px 1px 2px rgba(0, 0, 0, 0.4)"
                  : "none",
                transition:
                  "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.4s ease, height 0.4s ease, box-shadow 0.15s ease",
              }}
            />
          </div>

          {/* Outer Liquid Canvas Layer */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: `${dimensions.width}px`,
              height: `${dimensions.height}px`,
              transformStyle: "preserve-3d",
              transition:
                "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.4s ease, height 0.4s ease",
              transform: `translateZ(0px) ${
                isPressed ? "translateY(1px) scale(0.98)" : "translateY(0) scale(1)"
              }`,
              zIndex: 10,
            }}
          >
            <div
              style={{
                height: `${dimensions.height}px`,
                width: `${dimensions.width}px`,
                borderRadius: "100px",
                boxShadow: isPressed
                  ? "0px 0px 0px 1px rgba(0, 0, 0, 0.5), 0px 1px 2px 0px rgba(0, 0, 0, 0.3)"
                  : isHovered
                  ? "0px 0px 0px 1px rgba(255, 255, 255, 0.2), 0px 12px 20px 0px rgba(0, 0, 0, 0.35)"
                  : "0px 0px 0px 1px rgba(255, 255, 255, 0.1), 0px 6px 12px 0px rgba(0, 0, 0, 0.25)",
                transition:
                  "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.4s ease, height 0.4s ease, box-shadow 0.15s ease",
              }}
            >
              <canvas
                ref={canvasRef}
                width={dimensions.shaderWidth}
                height={dimensions.shaderHeight}
                style={{
                  borderRadius: "100px",
                  display: "block",
                  width: `${dimensions.shaderWidth}px`,
                  height: `${dimensions.shaderHeight}px`,
                }}
              />
            </div>
          </div>

          {/* Interactive Button */}
          <button
            ref={buttonRef}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseDown={() => setIsPressed(true)}
            onMouseUp={() => setIsPressed(false)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: `${dimensions.width}px`,
              height: `${dimensions.height}px`,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              outline: "none",
              zIndex: 40,
              transformStyle: "preserve-3d",
              transform: "translateZ(25px)",
              transition:
                "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.4s ease, height 0.4s ease",
              overflow: "hidden",
              borderRadius: "100px",
            }}
            aria-label={label}
          >
            {ripples.map((ripple) => (
              <span
                key={ripple.id}
                style={{
                  position: "absolute",
                  left: `${ripple.x}px`,
                  top: `${ripple.y}px`,
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0) 70%)",
                  pointerEvents: "none",
                  animation: "ripple-animation 0.6s ease-out",
                }}
              />
            ))}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LiquidMetalButton;
