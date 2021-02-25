export const smtp = {
	host: 'smtp.sendgrid.net',
	port: 587,
	secure: false, // true for 465, false for other ports
	auth: {
		user: 'apikey', // generated ethereal user
		pass: process.env.NODEMAILER_PASSWORD // generated ethereal password
	}
};

export const url = 'http://localhost:27017';

export const s3Config = {
	accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY,
	secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY
};
export const s3Region = 'ca-central-1';
export const s3Bucket = 'fileapp-dary';
