// src/hooks/usePrompt.js
import { useContext, useCallback, useEffect, useState } from "react";
import { UNSAFE_NavigationContext as NavigationContext } from "react-router-dom";

export function useBlocker(blocker, when = true) {
  const navigator = useContext(NavigationContext).navigator;
  useEffect(() => {
    if (!when) return;
    const unblock = navigator.block((tx) => {
      const autoUnblockingTx = {
        ...tx,
        retry() {
          unblock();
          tx.retry();
        },
      };
      blocker(autoUnblockingTx);
    });
    return unblock;
  }, [navigator, blocker, when]);
}

// show custom dialog when any navigation is attempted
export function usePrompt(when) {
  const [show, setShow] = useState(false);
  const [tx, setTx] = useState(null);

  const blocker = useCallback((transition) => {
    setShow(true);
    setTx(() => transition);
  }, []);

  useBlocker(blocker, when);

  // confirm or cancel
  const confirm = () => {
    setShow(false);
    tx.retry(); // let navigation through
  };
  const cancel = () => {
    setShow(false);
    setTx(null); // drop navigation
  };

  return [show, confirm, cancel];
}
