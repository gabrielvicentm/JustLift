const express = require('express');
const postController = require('../controller/postController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/create-post', authMiddleware, postController.createPost);
router.get('/user/:userId', authMiddleware, postController.getPostsByUser);
router.get('/:postId', authMiddleware, postController.getPostById);
router.post('/:postId/like', authMiddleware, postController.toggleLike);
router.post('/:postId/save', authMiddleware, postController.toggleSave);
router.post('/:postId/report', authMiddleware, postController.reportPost);
router.post('/:postId/comments', authMiddleware, postController.createComment);
router.post('/:postId/comments/:commentId/like', authMiddleware, postController.toggleCommentLike);

module.exports = router;
