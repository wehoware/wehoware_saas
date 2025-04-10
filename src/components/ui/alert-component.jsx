"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Reusable Alert Component
 * @param {Object} props - Component props
 * @param {boolean} props.open - Whether the alert is open
 * @param {Function} props.onOpenChange - Function to call when open state changes
 * @param {string} props.title - Alert title
 * @param {string} props.message - Alert message
 * @param {string} props.actionLabel - Label for the action button
 * @param {Function} props.onAction - Function to call when action button is clicked
 * @returns {JSX.Element} Alert component
 */
export default function AlertComponent({
  open,
  onOpenChange,
  title,
  message,
  actionLabel = "OK",
  onAction = () => {},
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onAction}>{actionLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
