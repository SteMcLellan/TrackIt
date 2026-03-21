  # Clerk Frontend Login

  ## Summary
  Replace Google sign-in in the frontend with Clerk.

  ## Job To Be Done
  A TrackIt user needs to sign in with Clerk and return to the app successfully.

  ## Required Behaviors
  - The login screen no longer uses Google Identity Services.
  - The frontend initializes Clerk at app startup.
  - Successful Clerk sign-in leads to authenticated app usage.
  - After Clerk sign-in, the frontend establishes the same TrackIt app session required for protected API usage without depending on Google Identity Services.
  - Existing return URL behavior is preserved.

  ## Acceptance Criteria
  - No Google sign-in script is loaded.
  - User can sign in with Clerk.
  - Clerk sign-in results in an authenticated TrackIt app session for the current browser session.
  - User lands on the intended page after login.

  ## Out Of Scope
  - Direct Clerk auth on protected API calls.
  - Machine-to-machine auth.
