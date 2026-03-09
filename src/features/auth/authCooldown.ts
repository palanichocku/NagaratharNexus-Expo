export function startCooldown(
  seconds: number,
  setValue: (updater: (prev: number) => number) => void
) {
  setValue(() => seconds);

  const id = setInterval(() => {
    setValue((prev) => {
      if (prev <= 1) {
        clearInterval(id);
        return 0;
      }
      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(id);
}