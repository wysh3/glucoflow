import { z } from 'zod';
export const masterEventSchema = z.discriminatedUnion('kind',[
 z.object({kind:z.literal('glucose'),payload:z.object({value:z.number().min(10).max(1000),context:z.enum(['fasting','postmeal','random']),timestamp:z.iso.datetime({offset:true}),medicationTiming:z.string().max(160).default('')})}),
 z.object({kind:z.literal('symptom'),payload:z.object({body:z.string().trim().min(1).max(1000),severity:z.enum(['mild','moderate','severe']),timestamp:z.iso.datetime({offset:true})})}),
 z.object({kind:z.literal('screening'),payload:z.object({test:z.enum(['Retinal screening','Renal monitoring','Foot / neuropathy review','Cardiovascular review']),lastDate:z.iso.date().nullable(),intervalDays:z.number().int().min(1).max(730)})}),
 z.object({kind:z.literal('category'),payload:z.object({category:z.enum(['Routine maintenance','Higher supervision'])})}),
 z.object({kind:z.literal('sos'),payload:z.object({}).strict()}),
 z.object({kind:z.literal('ack_sos'),payload:z.object({snapshotId:z.uuid()})}),
]);
export type MasterEventInput=z.infer<typeof masterEventSchema>;
export type MasterEvent={id:string;kind:MasterEventInput['kind'];payload:Record<string,unknown>;createdAt:string;actorId:string;digest:string|null};
export type MasterProfile={patientId:string;scenario:boolean;events:MasterEvent[];serverTime:string};
