// Leave Transaction Form
// ======================
// Decides where the user goes after Save, Cancel or Delete on the
// transaction edit page, and after Create or Cancel on the new
// transaction page.
//
// The edit page is normally reached by clicking a card, so "go back"
// returns to the (possibly filtered) list. But a card Cmd/Ctrl+clicked
// opens the edit page in a NEW tab with no history: router.back() would
// do nothing there. In that case we close the tab instead, returning the
// user to the list tab they came from.
//
// A tab only counts as "opened from Ouriva" when it has no Ouriva page to
// go back to AND the referrer is our own origin. A bookmark or pasted URL
// has no same-origin referrer, so those tabs are never closed: they go to
// the transactions list instead.

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Browsers ignore window.close() for some tabs (Safari is strict). If the
// tab is still open after this delay, we fall back to the list instead.
const CLOSE_FALLBACK_DELAY_MS = 150;

// Is there an Ouriva page earlier in this tab's history?
// history.length can't answer this: it also counts other sites' pages and
// the browser's blank new-tab page, so a URL pasted into a new tab has a
// length of 2 and router.back() would leave the app. The Navigation API's
// canGoBack only considers same-origin entries. Browsers without it fall
// back to history.length.
function canGoBackInApp(): boolean {
  // lib.dom types `navigation` as always present; older browsers lack it.
  const navigation: Navigation | undefined = window.navigation;
  return navigation ? navigation.canGoBack : window.history.length > 1;
}

function isReferrerSameOrigin(): boolean {
  if (!document.referrer) return false;
  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function useLeaveTransactionForm() {
  const router = useRouter();

  // replace, not push: the form being left (or the transaction just
  // deleted) must not sit behind the list in history, or Back would
  // reopen it.
  function goToList() {
    router.replace("/transactions");
    router.refresh();
  }

  // `otherwise` is the normal in-tab navigation for the calling action:
  // router.back() for Save/Cancel when editing, the list (the default)
  // for Create and Delete.
  return function leaveTransactionForm(otherwise: () => void = goToList) {
    // An Ouriva page to go back to: the normal case.
    if (canGoBackInApp()) {
      otherwise();
      return;
    }

    // No history and not opened from Ouriva (bookmark, pasted URL):
    // there is nothing to go back to, so show the list.
    if (!isReferrerSameOrigin()) {
      goToList();
      return;
    }

    // Side tab opened from Ouriva: close it.
    // window.closed turns true as soon as a close is under way, so the
    // fallback only runs when the browser refused to close the tab.
    window.close();
    setTimeout(() => {
      if (!window.closed) goToList();
    }, CLOSE_FALLBACK_DELAY_MS);
  };
}

// After a successful save or delete, forms keep their button disabled
// while the page leaves. If the browser later restores this page from its
// back/forward cache (e.g. Forward after router.back() left the site in a
// browser without the Navigation API), that frozen state would leave the
// button disabled forever. `reset` re-enables it on such a restore.
export function useResetOnPageRestore(reset: () => void) {
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) reset();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [reset]);
}
