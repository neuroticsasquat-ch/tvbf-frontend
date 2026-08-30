/** The count beside a tab label. Muted so the label stays the thing you read. */
export function TabCount({ value }: { value: number }) {
  return <span className="font-normal text-muted-foreground">({value})</span>;
}
