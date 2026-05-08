This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started


```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

# Magic Card

Card Number	4012 8888 8888 1881

CVV	123
Card Holder	Any Name (e.g., "Test User")

## Deploy on Vercel


# kill all next dev processes on ports 3000, 3001 and higher
pkill -f "next dev" 2>/dev/null; lsof -ti:3000,3001,3002,3003,3004,3005,3006,3007,3008,3009 | xargs kill -9 2>/dev/null; rm -f .next/dev/lock; echo "All next dev processes killed"
