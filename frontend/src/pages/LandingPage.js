import React from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Container,
  Typography,
  Grid,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { motion } from "framer-motion";
import { styled } from "@mui/material/styles";

// Styled components
const HeroSection = styled(Box)(({ theme }) => ({
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  color: "white",
  position: "relative",
  overflow: "hidden",
  "&::before": {
    content: '""',
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "url(/images/pattern.svg)",
    opacity: 0.1,
  },
}));

const AnimatedTypography = motion(Typography);
const AnimatedButton = motion(Button);

const LandingPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <HeroSection>
      <Container>
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={6}>
            <Box sx={{ textAlign: isMobile ? "center" : "left" }}>
              <AnimatedTypography
                variant="h1"
                component="h1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                sx={{
                  fontSize: { xs: "2.5rem", md: "3.5rem" },
                  fontWeight: 700,
                  mb: 2,
                }}
              >
                Diabetes Guard
              </AnimatedTypography>
              <AnimatedTypography
                variant="h2"
                component="h2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                sx={{
                  fontSize: { xs: "1.5rem", md: "2rem" },
                  mb: 4,
                  opacity: 0.9,
                }}
              >
                Your Workforce Diabetes Management Companion
              </AnimatedTypography>
              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  justifyContent: isMobile ? "center" : "flex-start",
                }}
              >
                <AnimatedButton
                  component={RouterLink}
                  to="/register"
                  variant="contained"
                  size="large"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  sx={{
                    bgcolor: "white",
                    color: "primary.main",
                    "&:hover": {
                      bgcolor: "grey.100",
                    },
                  }}
                >
                  Get Started
                </AnimatedButton>
                <AnimatedButton
                  component={RouterLink}
                  to="/login"
                  variant="outlined"
                  size="large"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                  sx={{
                    borderColor: "white",
                    color: "white",
                    "&:hover": {
                      borderColor: "grey.100",
                      bgcolor: "rgba(255, 255, 255, 0.1)",
                    },
                  }}
                >
                  Login
                </AnimatedButton>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            ></motion.div>
          </Grid>
        </Grid>
      </Container>
    </HeroSection>
  );
};

export default LandingPage;
