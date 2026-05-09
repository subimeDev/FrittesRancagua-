import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    initialScope: {
      tags: {
        tenant: "frittes-maison",
      },
    },
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.phone;
      }
      if (event.request?.data && typeof event.request.data === "string") {
        event.request.data = event.request.data
          .replace(/\+56\d{8,9}/g, "[redacted_phone]")
          .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted_email]");
      }
      return event;
    },
  });
}
