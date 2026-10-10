import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectedReaction,normalizeMessage} from './messages.mjs';
test('last selected laugh (0) wins over earlier heart',()=>{const raw={reactions:{0:{0:2,5:1}},currentReaction:0};assert.equal(selectedReaction(raw),0);assert.equal(normalizeMessage({id:'1',type:'MSG_TEXT',time:1,message:'test',...raw}).currentReaction,0);});
test('selection is scoped to self and falls back to own latest event',()=>{assert.equal(selectedReaction({reactions:{12:{5:2},0:{0:1}},currentReaction:5,lastReaction:0,lastReactionMine:true}),0);assert.equal(selectedReaction({reactions:{12:{5:2}},currentReaction:5}),null);assert.equal(selectedReaction({reactions:{12:{0:1,5:1}},reactionUsers:{12:{mine:true}},currentReaction:0}),0);});
test('removed and recalled reactions cannot retain a selected icon',()=>{assert.equal(selectedReaction({reactions:{0:{0:0}},currentReaction:0}),null);assert.equal(normalizeMessage({id:'1',type:'MSG_UNDO',time:1,message:'',reactions:{0:{5:1}},currentReaction:5}).currentReaction,null);});
test('new self event supersedes cached icon from a different client',()=>{assert.equal(selectedReaction({reactions:{0:{0:2,5:1}},currentReaction:5,lastReaction:0,lastReactionMine:true}),0);});
