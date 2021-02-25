import path from 'path';
import { version } from '../package.json';
import _ from 'lodash';
import File from './models/file';
import Post from './models/post';
import { ObjectID } from 'mongodb';
import FileArchiver from './archiver';
import Email from './email';
import S3 from './s3';

class AppRouter {
	constructor(app) {
		this.app = app;
		this.setupRouters();
	}

	setupRouters() {
		const app = this.app;
		const db = app.get('db');
		const uploadDir = app.get('storageDir');
		const upload = app.upload;

		//route routing.
		app.get('/', (req, res, next) => {
			return res.status(200).json({
				version: version
			});
		});

		//upload routing
		app.post('/api/upload', upload.array('files'), (req, res, next) => {
			const files = _.get(req, 'files', []);

			console.log('files objects from s3 multer', files);
			let fileModels = [];

			_.each(files, (fileObject) => {
				const newFile = new File(app).initWithObject(fileObject).toJSON();
				fileModels.push(newFile);
			});

			if (fileModels.length) {
				db.collection('files').insertMany(fileModels, (err, result) => {
					if (err) {
						return res.status(503).json({
							error: {
								message: 'unable to save your files'
							}
						});
					}

					let post = new Post(app)
						.initWithObject({
							from: _.get(req, 'body.from'),
							to: _.get(req, 'body.to'),
							message: _.get(req, 'body.message'),
							files: result.insertedIds
						})
						.toJSON();

					// let save post object to posts collection

					db.collection('posts').insertOne(post, (err, result) => {
						if (err) {
							return res.status(503).json({ error: { message: 'Your upload could not be saved.' } });
						}
						// implement email sending to userwith download link.

						// send email
						const sendEmail = new Email(app).sendDownloadLink(post, (err, info) => {
							sendEmail.sendDownloadLink(post, (err, info) => {
								if (err) {
									console.log('error sending email notify downloading link', err);
								}
							});
						});

						//callback to react app with post details.
						return res.json(post);
					});
				});
			} else {
				return res.status(503).json({
					error: { message: 'file upload is required' }
				});
			}
		});

		//Download routing

		app.get('/api/download/:id', (req, res, next) => {
			const fileId = req.params.id;

			db.collection('files').find({ _id: ObjectID(fileId) }).toArray((err, result) => {
				const fileName = _.get(result, '[0].name');

				if (err || !fileName) {
					return res.status(404).json({
						error: {
							message: 'file not found'
						}
					});
				}

				// download file from s3 service
				const file = _.get(result, '[0]');
				const downloader = new S3(app, res);

				//return downloader.download(file); Proxy download from s3 service

				//Download Directly from S3

				const downloadUrl = downloader.getDownloadUrl(file);

				return res.redirect(downloadUrl);

				/*const filePath = path.join(uploadDir, fileName);
                return res.download(filePath, _.get(result, '[0].originalName'), (err) => {
                    if(err){
                        return res.status(404).json({
                            error: {
                                message: "file not found"
                            }
                        });
                    }else{
                        console.log("file downloaded");
                    }
                });*/
			});
		});

		//routing for post detail /api/posts/:id

		app.get('/api/posts/:id', (req, res, next) => {
			const postId = _.get(req, 'params.id');

			this.getPostById(postId, (err, result) => {
				if (err) {
					return res.status(404).json({ error: { message: 'File not found.' } });
				}

				return res.json(result);
			});
		});

		//routing download zip files.
		app.get('/api/posts/:id/download', (req, res, next) => {
			const id = _.get(req, 'params.id', null);

			this.getPostById(id, (err, result) => {
				if (err) {
					return res.status(404).json({ error: { message: 'File not found.' } });
				}

				const files = _.get(result, 'files', []);

				const archiver = new FileArchiver(app, files, res).download();

				return archiver;
			});
		});
	}

	getPostById(id, callback = () => {}) {
		const app = this.app;

		const db = app.get('db');

		let postObjectId = null;

		try {
			postObjectId = new ObjectID(id);
		} catch (err) {
			return callback(err, null);
		}
		db.collection('posts').find({ _id: postObjectId }).limit(1).toArray((err, results) => {
			let result = _.get(results, '[0]');

			if (err || !result) {
				return callback(err ? err : new Error('file not found.'));
			}

			const fileIds = _.get(result, 'files', []);

			db.collection('files').find({ _id: { $in: fileIds } }).toArray((err, files) => {
				if (err || !files || !files.length) {
					return callback(err ? err : new Error('file not found.'));
				}
				result.files = files;

				return callback(null, result);
			});
		});
	}
}

export default AppRouter;
