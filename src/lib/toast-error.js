import { toast } from "react-hot-toast";

/**
 * Show a generic error toast to the user while logging the real error
 * to the console. Use in catch blocks instead of toast.error(err.message)
 * so internal/API error details are never surfaced in the UI.
 *
 * toastError(err, "Failed to save post");
 */
export function toastError(err, fallback = "Something went wrong") {
  console.error(err);
  toast.error(fallback);
}
