import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import logger from "./logger";

/**
 * NavigationTracker is a component that logs navigation events in the application.
 * It should be used at the top level of your application to track all route changes.
 */
function NavigationTracker() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const prevLocationRef = useRef(null);

  useEffect(() => {
    // Skip first render
    if (prevLocationRef.current) {
      // Get current and previous paths
      const currentPath = location.pathname;
      const previousPath = prevLocationRef.current.pathname;

      // Log navigation only if the path actually changed
      if (currentPath !== previousPath) {
        logger.navigation(previousPath, currentPath, {
          navigationType,
          search: location.search,
          hash: location.hash,
          state: location.state,
        });

        // Also track page views as user actions
        logger.userAction("page_view", {
          path: currentPath,
          previousPath,
          search: location.search,
        });

        // Set up performance monitoring for this page
        const pageTimer = logger.startTimer("page_render");

        // Measure time until page becomes interactive
        window.requestIdleCallback
          ? window.requestIdleCallback(
              () => {
                pageTimer.stop({
                  path: currentPath,
                  interactive: true,
                });
              },
              { timeout: 5000 }
            )
          : setTimeout(() => {
              pageTimer.stop({
                path: currentPath,
                interactive: true,
              });
            }, 300);
      }
    }

    // Update previous location
    prevLocationRef.current = location;
  }, [location, navigationType]);

  return null; // This component doesn't render anything
}

export default NavigationTracker;
