#include <iostream>
#include <string>
#include <windows.h>


std::string toLowercase(const std::string& str) {
    std::string result;
    for (const char& c : str) {
        result += std::tolower(c);
    }
    return result;
}


std::string addDashIfTwoWords(const std::string& name) {
    std::string result;
    size_t spaceIndex = name.find(' ');
    if (spaceIndex != std::string::npos) {
        result = name.substr(0, spaceIndex) + "-" + name.substr(spaceIndex + 1);
    }
    else {
        result = name;
    }
    return result;
}

void displayMenu(bool isRussian) {
    if (isRussian) {
        std::cout << "$$$ если имя героя состоит из двух слов, введите их через пробел $$$" << std::endl;
        std::cout << "" << std::endl;
        std::cout << "Что вы хотите узнать? (1 - текущие билды, 2 - контргерои): ";
    } else {
        std::cout << "$$$ if the hero's name consists of two words, type it separated by a space plz $$$" << std::endl;
        std::cout << "" << std::endl;
        std::cout << "What do you want to know? (1 - current builds, 2 - counters): ";
    }
}


void processChoice(int choice, bool isRussian) {
    std::string hero;
    std::string url;

    switch (choice) {
    case 1:
        if (isRussian) {
            std::cout << "Введите имя героя: ";
        } else {
            std::cout << "Enter hero name: ";
        }
        std::cin.ignore();
        std::getline(std::cin, hero);
        hero = addDashIfTwoWords(hero);
        url = "https://www.dotabuff.com/heroes/" + toLowercase(hero) + "/guides";
        if (isRussian) {
            std::cout << "Ссылка на текущие билды: " << url << std::endl;
        } else {
            std::cout << "Link to current builds: " << url << std::endl;
        }
        ShellExecuteA(NULL, "open", url.c_str(), NULL, NULL, SW_SHOWNORMAL);
        break;
    case 2:
        if (isRussian) {
            std::cout << "Введите имя героя: ";
        } else {
            std::cout << "Enter hero name: ";
        }
        std::cin.ignore();
        std::getline(std::cin, hero);
        hero = addDashIfTwoWords(hero);
        url = "https://www.dotabuff.com/heroes/" + toLowercase(hero) + "/counters";
        if (isRussian) {
            std::cout << "Ссылка на контргероев: " << url << std::endl;
        } else {
            std::cout << "Link to counters: " << url << std::endl;
        }
        ShellExecuteA(NULL, "open", url.c_str(), NULL, NULL, SW_SHOWNORMAL);
        break;
    default:
        if (isRussian) {
            std::cout << "Неверный выбор." << std::endl;
        } else {
            std::cout << "Invalid choice." << std::endl;
        }
        return;
    }

    std::cout << "--------------------------" << std::endl;
    displayMenu(isRussian);

    int newChoice;
    std::cin >> newChoice;
    processChoice(newChoice, isRussian);
}

int main() {

    std::cout << "Choose language / Выберите язык (1 - English, 2 - Russian): ";
    int langChoice;
    std::cin >> langChoice;

    bool isRussian = (langChoice == 2);

    displayMenu(isRussian);

    int choice;
    std::cin >> choice;

    processChoice(choice, isRussian);

    return 0;
}
