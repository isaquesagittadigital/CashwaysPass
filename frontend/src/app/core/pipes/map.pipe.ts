import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'map',
    standalone: true
})
export class MapPipe implements PipeTransform {
    transform(array: any[] | null | undefined, key: string): any[] {
        if (!array || !key) return [];
        return array.map(item => item[key]);
    }
}
