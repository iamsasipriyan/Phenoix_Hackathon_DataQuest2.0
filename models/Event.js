const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['CALENDAR_EVENT', 'REMINDER', 'TODO', 'UNKNOWN'],
        required: true
    },
    data: {
        title: String,
        description: String,
        startTime: Date,
        endTime: Date,
        location: String,
        priority: {
            type: String,
            enum: ['HIGH', 'MEDIUM', 'LOW', null]
        }
    },
    reminderSent: {
        type: Boolean,
        default: false
    },
    originalInput: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Event', eventSchema);
