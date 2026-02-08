// web/src/components/common/Loader.jsx
import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

const Loader = ({ message = 'Chargement...', fullScreen = false }) => {
    const containerStyle = fullScreen
        ? {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.9)',
            zIndex: 9999,
        }
        : {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '40px',
        };

    return (
        <Box sx={containerStyle}>
            <CircularProgress size={60} sx={{ color: '#2E86C1', marginBottom: 2 }} />
            {message && (
                <Typography variant="body1" color="textSecondary">
                    {message}
                </Typography>
            )}
        </Box>
    );
};

export default Loader;