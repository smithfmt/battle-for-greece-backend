import { SquareType } from "./types";
import _ from 'lodash';

export const slugify = (str:string) => {
    str = str.replace(/^\s+|\s+$/g, ''); // trim
    str = str.toLowerCase();

    // remove accents, swap ñ for n, etc
    const from = "àáãäâèéëêìíïîòóöôùúüûñç·/_,:;";
    const to   = "aaaaaeeeeiiiioooouuuunc------";

    for (let i=0, l=from.length ; i<l ; i++) {
        str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
    }

    str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
        .replace(/\s+/g, '-') // collapse whitespace and replace by -
        .replace(/-+/g, '-'); // collapse dashes

    return str;
};

export const compare = (str1:string, str2:string) => {
    let position = 0;
    let score = 0;
    const result:{char:string,correct:string}[] = [];
    let last = true;
    let offset = false;
    const test = str1.split("");
    const answer = str2.split("");
    test.forEach(char => {
        if (answer[position]===char) {
            result.push({char, correct: "correct"});
            score++;
            last = true;
        } else if ((last===false || offset===true) && answer[position-1]===char) {
            result.push({char, correct: "correct"});
            score++;
            last = true;
            offset = true;
        } else {
            result.push({char, correct: "incorrect"});
            last = false;
        };
        position++;
    });
    if (test.length < answer.length) {
        const remaining = answer.slice(test.length);
        remaining.forEach((char) => {
            result.push({char, correct: "incorrect"});
        });
    };
    const percentage = test.length>answer.length-1 ? Math.floor((score/test.length)*100) : Math.floor((score/answer.length)*100);
    return [result, percentage];
};

export const shuffle = (array:any[]) => {
    let currentIndex = array.length;
    let temporaryValue:any;
    let randomIndex:number;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    };
    return array;
  };

export const removeDuplicates = (squareArr:SquareType[]) => {
    let result:SquareType[] = []
    squareArr.forEach(square => {
      if (!result.filter(resSquare => {return _.isEqual(resSquare, square);}).length) {
        result.push(square);
      };
    });
    return result;
  };