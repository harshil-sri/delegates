import { spawn } from 'node:child_process';
import { root, runtime } from './runtime.mjs';
import { resolve } from 'node:path';

async function command(args,input='') {
  return new Promise((done,failed)=>{
    const child=spawn('docker',args,{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='';
    const timer=setTimeout(()=>{child.kill();failed(new Error('Switch identity lookup timed out.'));},20000);
    child.stdout.on('data',bytes=>{stdout+=bytes;});
    child.stderr.on('data',bytes=>{stderr+=bytes;});
    child.stdin.on('error',()=>{});
    child.on('error',error=>{clearTimeout(timer);failed(error);});
    child.on('close',code=>{clearTimeout(timer);code===0?done(stdout.trim()):failed(new Error(`Read-only Switch identity lookup failed: ${stderr.slice(0,600)}`));});
    child.stdin.end(input);
  });
}
const literal = value => "'"+String(value).replaceAll("'","''")+"'";

// Switch 0.31.0's HTTP timeline has opaque senders, but its public directory
// omits the native-account -> client mapping. Read that mapping during trusted
// local setup; never synthesize a sender from a username or display name.
// No core table is written. The runtime uses the frozen result, not SQL.
export async function readSwitchIdentityBindings(config,env,bridgeId,humanIds) {
  if (config.switchVersion!=='0.31.0') throw new Error('Reverify the identity lookup schema before changing the pinned Switch release.');
  const container=await command(['compose','--env-file',resolve(runtime,'stack.env'),'-p','creative-veto-spike','-f',resolve(root,'infra','compose.yml'),'ps','-q','postgres']);
  if (!/^[a-f0-9]{12,64}$/.test(container)) throw new Error('The pinned Switch PostgreSQL container is not running.');
  const sql=`BEGIN TRANSACTION READ ONLY;
    SELECT json_build_object(
      'humans',(SELECT coalesce(json_agg(h),'[]'::json) FROM (
        SELECT eu.external_user_id AS "platformUserId",eu.external_username AS username,c.matrix_user_id AS sender,c.type
        FROM external_users eu JOIN clients c ON c.id=eu.client_id AND c.tenant_id=eu.tenant_id
        JOIN client_rooms cr ON cr.client_id=c.id AND cr.tenant_id=c.tenant_id
        WHERE eu.bridge_id=${literal(bridgeId)} AND cr.room_id=${literal(config.room.id)} AND eu.external_user_id IN (${humanIds.map(literal).join(',')})
      ) h),
      'agents',(SELECT coalesce(json_agg(a),'[]'::json) FROM (
        SELECT a.id,a.name,c.matrix_user_id AS sender,c.type FROM agents a
        JOIN clients c ON c.id=a.client_id AND c.tenant_id=a.tenant_id
        JOIN client_rooms cr ON cr.client_id=c.id AND cr.tenant_id=c.tenant_id
        WHERE cr.room_id=${literal(config.room.id)} AND a.id IN (${Object.values(config.actors).map(actor=>literal(actor.id)).join(',')})
      ) a)
    ); COMMIT;`;
  return JSON.parse(await command(['exec','-i',container,'psql','-U',env.DB_OWNER_USER,'-d',env.DB_NAME,'-qAt','-v','ON_ERROR_STOP=1'],sql));
}
