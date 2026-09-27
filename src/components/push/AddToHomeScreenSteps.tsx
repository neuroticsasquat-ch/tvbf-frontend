/** iOS delivers push only to an app opened from the Home Screen, so on an
 * iPhone or iPad tab this is the whole of "turning on" (§6.3, §6.4). */
export function AddToHomeScreenSteps() {
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground">
        On iPhone and iPad, notifications work only once TV BingeFriend is on your Home Screen:
      </p>
      <ol className="list-decimal pl-5 text-muted-foreground">
        <li>Tap the Share button in Safari.</li>
        <li>Choose Add to Home Screen.</li>
        <li>Open TV BingeFriend from your Home Screen and come back to Settings.</li>
      </ol>
    </div>
  );
}
