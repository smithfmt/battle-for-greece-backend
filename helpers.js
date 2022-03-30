module.exports.slugify = (str) => {
    str = str.replace(/^\s+|\s+$/g, ''); // trim
    str = str.toLowerCase();
  
    // remove accents, swap ñ for n, etc
    var from = "àáãäâèéëêìíïîòóöôùúüûñç·/_,:;";
    var to   = "aaaaaeeeeiiiioooouuuunc------";

    for (var i=0, l=from.length ; i<l ; i++) {
        str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
    }

    str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
        .replace(/\s+/g, '-') // collapse whitespace and replace by -
        .replace(/-+/g, '-'); // collapse dashes

    return str;
};

module.exports.compare = (str1, str2) => {
    let position = 0;
    let score = 0;
    let result = [];
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

module.exports.shuffle = (array) => {
    var currentIndex = array.length, temporaryValue, randomIndex;
  
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
  
      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
  
    return array;
  }