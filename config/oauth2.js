const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const { generateToken } = require("../services/jwt.service");
const { createRefreshToken } = require("../services/refreshToken.service");


const FRONTEND_REDIRECT_URL =
  process.env.OAUTH2_REDIRECT_URL || "https://ems.webie.com.vn/oauth2/redirect";

function initPassport() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName;
          const picture = profile.photos?.[0]?.value;

          // TODO: thay bằng authService thực tế
          // const user = await authService.processOAuthPostLogin(email, name, picture);
          const user = { email, name, picture, uid: profile.id };

          done(null, user);
        } catch (err) {
          done(err, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
}

/**
 * Xử lý redirect sau khi OAuth2 thành công
 * Tương đương onAuthenticationSuccess() trong Spring Boot
 */
async function oauth2SuccessHandler(req, res) {
  try {
    const user = req.user;

    const accessToken = generateToken(user.email);
    const refreshToken = await createRefreshToken(user.email);

    const redirectUrl = new URL(FRONTEND_REDIRECT_URL);
    redirectUrl.searchParams.set("accessToken", accessToken);
    redirectUrl.searchParams.set("refreshToken", refreshToken);
    redirectUrl.searchParams.set("uid", user.uid);

    res.redirect(redirectUrl.toString());
  } catch (err) {
    res.status(500).json({ message: "OAuth2 callback error", error: err.message });
  }
}

module.exports = { initPassport, oauth2SuccessHandler };