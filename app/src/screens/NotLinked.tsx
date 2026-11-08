export function NotLinked({ badLink }: { badLink: boolean }) {
  return (
    <main className="center-screen">
      <div className="card narrow">
        <h1 className="display">This app isn't linked to a sheet yet</h1>
        {badLink && (
          <p className="notice warn" role="alert">
            The link you opened doesn't look complete. Copy it again from your sheet.
          </p>
        )}
        <p>
          Open your personal app link once on this device. You'll find it in your Google Sheet under{' '}
          <strong>Coaching Tracker › Show my app link</strong>.
        </p>
      </div>
    </main>
  );
}
