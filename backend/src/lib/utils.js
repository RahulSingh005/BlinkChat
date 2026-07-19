import jwt from 'jsonwebtoken';

// Generates a 6-digit numeric OTP for password-reset verification.
export const generateOtp = () =>
    Math.floor(100000 + Math.random() * 900000).toString();

export const generateToken = (userId, res) => {
    const token = jwt.sign({userId} ,process.env.JWT_SECRET,{expiresIn: '7d'})

    // In production the frontend (e.g. Vercel) and backend are typically on
    // different domains, so this is a cross-site cookie. Browsers only send
    // cross-site cookies when SameSite=None *and* Secure=true; "Strict" (or
    // even "Lax") gets silently dropped on every cross-domain request,
    // which looks exactly like "the session isn't persisting".
    const isProd = process.env.NODE_ENV === "production";
    res.cookie("jwt", token,{
        maxAge: 7 * 24 * 60 * 60 * 1000, // MS 
        httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
        sameSite: isProd ? "None" : "Lax",
        secure: isProd,
    })
    return token;
}